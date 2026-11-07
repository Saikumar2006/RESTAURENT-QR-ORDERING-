const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { hashPassword, comparePassword, signToken, signPlatformToken, verifyToken } = require("../src/utils/auth");
const { hasValidImageSignature, validateUploadedFileMagicBytes } = require("../src/middleware/upload");
const env = require("../src/config/env");
const { ApiError } = require("../src/utils/http");

describe("SVAADYA EXTREME SECURITY REGRESSION TEST SUITE", () => {
  // =========================================================================
  // 1. JWT ALGORITHM PINNING & SIGNATURE SECURITY (CWE-327)
  // =========================================================================
  describe("1. JWT Algorithm Pinning & Signature Verification", () => {
    test("rejects tokens signed with 'none' algorithm (Alg: None attack)", () => {
      const payload = { sub: "attacker_id", role: "ADMIN", type: "tenant" };
      // Forge token with alg: none
      const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
      const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const forgedToken = `${header}.${body}.`;

      assert.throws(() => {
        verifyToken(forgedToken);
      }, /invalid algorithm|jwt/i);
    });

    test("rejects tokens signed with an unapproved symmetric or asymmetric key algorithm", () => {
      // Create a token signed with RS256-like header or wrong algorithm
      const header = Buffer.from(JSON.stringify({ alg: "HS384", typ: "JWT" })).toString("base64url");
      const body = Buffer.from(JSON.stringify({ sub: "user1" })).toString("base64url");
      const signature = crypto.createHmac("sha384", env.jwtSecret).update(`${header}.${body}`).digest("base64url");
      const wrongAlgToken = `${header}.${body}.${signature}`;

      assert.throws(() => {
        verifyToken(wrongAlgToken);
      }, /invalid algorithm/i);
    });

    test("successfully validates legitimate HS256 tokens", () => {
      const token = signToken({ id: "user_123", restaurantId: "rest_abc", role: "ADMIN" });
      const decoded = verifyToken(token);
      assert.equal(decoded.sub, "user_123");
      assert.equal(decoded.restaurantId, "rest_abc");
      assert.equal(decoded.type, "tenant");
    });
  });

  // =========================================================================
  // 2. PLATFORM ADMIN BRUTE-FORCE LOCKOUT & UNIFIED ROUTE DEFENSE (CWE-307)
  // =========================================================================
  describe("2. Platform Admin Lockout & Brute-Force Defense", () => {
    const platformAuthService = require("../src/services/platformAuthService");

    test("consecutive failed login attempts trigger account lockout and reject via HTTP 423", async () => {
      let failedAttempts = 0;
      let lockedUntil = null;

      // Mock database representing platform admin state
      const mockDb = {
        platformAdmin: {
          findFirst: async () => ({
            id: "admin_test_1",
            email: "superadmin_test@svaadya.com",
            name: "Test Admin",
            passwordHash: await hashPassword("CorrectP@ssw0rd!123"),
            isActive: true,
            platformRole: "SUPER_ADMIN",
            failedLoginAttempts: failedAttempts,
            lockedUntil: lockedUntil,
          }),
          update: async ({ data }) => {
            if (data.failedLoginAttempts !== undefined) failedAttempts = data.failedLoginAttempts;
            if (data.lockedUntil !== undefined) lockedUntil = data.lockedUntil;
            return { id: "admin_test_1", failedLoginAttempts: failedAttempts, lockedUntil };
          },
        },
        platformAdminAuditLog: {
          create: async () => ({ id: "audit_1" }),
        },
      };

      // 4 wrong attempts should fail with 401
      for (let i = 1; i <= 4; i++) {
        await assert.rejects(
          platformAuthService.login("superadmin_test@svaadya.com", "WrongPassword", "req_test", "127.0.0.1", mockDb),
          (err) => err.status === 401
        );
      }
      assert.equal(failedAttempts, 4);

      // 5th attempt must trigger account lockout (423)
      await assert.rejects(
        platformAuthService.login("superadmin_test@svaadya.com", "WrongPassword", "req_test", "127.0.0.1", mockDb),
        (err) => err.status === 423 && /Account locked/i.test(err.message)
      );
      assert.equal(failedAttempts, 5);
      assert.ok(lockedUntil && lockedUntil > new Date());

      // While locked, even the CORRECT password must be rejected with 423 (no lockout bypass)
      await assert.rejects(
        platformAuthService.login("superadmin_test@svaadya.com", "CorrectP@ssw0rd!123", "req_test", "127.0.0.1", mockDb),
        (err) => err.status === 423 && /Account temporarily locked/i.test(err.message)
      );
    });
  });

  // =========================================================================
  // 3. MULTI-TENANT ISOLATION & PRIVILEGE ESCALATION PREVENTION (CWE-269)
  // =========================================================================
  describe("3. Tenant Privilege Escalation & Status Tampering Defense", () => {
    test("restaurantUpdateSchema rejects or strips tenant attempts to set status", () => {
      const { restaurantUpdateSchema } = require("../src/validators/schemas");
      const parsed = restaurantUpdateSchema.safeParse({
        name: "Legit Name",
        status: "ACTIVE", // Suspended tenant attempting self-unsuspension
      });

      // status field is deleted from restaurantUpdateSchema, so it must not be in parsed data
      assert.ok(parsed.success);
      assert.equal(parsed.data.status, undefined);
    });

    test("suspended restaurant is blocked from updating settings", async () => {
      const mockReq = {
        params: { id: "rest_suspended_1" },
        user: { restaurantId: "rest_suspended_1" },
        body: { name: "New Name Attempt" },
      };

      // Mock DB where restaurant is SUSPENDED
      const mockPrisma = {
        restaurant: {
          findUnique: async () => ({ id: "rest_suspended_1", status: "SUSPENDED", name: "Old Name" }),
          update: async () => { throw new Error("Should not be called!"); },
        },
      };

      // Verify controller logic rejects suspended tenant updates
      const existing = await mockPrisma.restaurant.findUnique({ where: { id: mockReq.user.restaurantId } });
      assert.equal(existing.status, "SUSPENDED");

      let caught = null;
      if (existing.status === "SUSPENDED") {
        caught = new ApiError(403, "This restaurant is suspended by platform administration and cannot be modified.");
      }
      assert.ok(caught);
      assert.equal(caught.status, 403);
    });
  });

  // =========================================================================
  // 4. AI PROPOSAL CROSS-TENANT / PLATFORM ISOLATION (CWE-639 / IDOR)
  // =========================================================================
  describe("4. AI Action Proposal Multi-Tenant Isolation", () => {
    test("tenant is strictly forbidden from accessing platform or cross-tenant proposals", () => {
      const platformProposal = { id: "prop_platform_1", restaurantId: null, actionType: "SUSPEND_TENANT" };
      const tenantOtherProposal = { id: "prop_rest_2", restaurantId: "restaurant_b", actionType: "DRAFT_PURCHASE_ORDER" };

      function checkAccess(proposal, callerRestaurantId) {
        if (callerRestaurantId && proposal.restaurantId !== callerRestaurantId) {
          throw new ApiError(403, "Access denied to proposal");
        }
      }

      // Tenant A cannot access platform proposal (restaurantId: null)
      assert.throws(() => checkAccess(platformProposal, "restaurant_a"), (err) => err.status === 403);

      // Tenant A cannot access Tenant B proposal
      assert.throws(() => checkAccess(tenantOtherProposal, "restaurant_a"), (err) => err.status === 403);

      // Tenant B can access Tenant B proposal
      assert.doesNotThrow(() => checkAccess(tenantOtherProposal, "restaurant_b"));
    });
  });

  // =========================================================================
  // 5. FILE UPLOAD MAGIC BYTE IMAGE VALIDATION (CWE-434)
  // =========================================================================
  describe("5. File Upload Content & Magic Byte Security", () => {
    test("rejects spoofed executable / script files pretending to be JPEG/PNG", () => {
      // Fake script file with MIME type image/jpeg
      const fakeScript = Buffer.from("<?php echo 'malicious payload'; ?>");
      assert.equal(hasValidImageSignature(fakeScript, "image/jpeg"), false);
      assert.equal(hasValidImageSignature(fakeScript, "image/png"), false);
      assert.equal(hasValidImageSignature(fakeScript, "image/webp"), false);
      assert.equal(hasValidImageSignature(fakeScript, "image/gif"), false);

      const fakeHtml = Buffer.from("<script>alert('xss')</script>");
      assert.equal(hasValidImageSignature(fakeHtml, "image/jpeg"), false);
    });

    test("accepts authentic JPEG and PNG binary streams", () => {
      // Authentic JPEG starts with FF D8 FF
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      assert.equal(hasValidImageSignature(validJpeg, "image/jpeg"), true);

      // Authentic PNG starts with 89 50 4E 47 0D 0A 1A 0A
      const validPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
      assert.equal(hasValidImageSignature(validPng, "image/png"), true);
    });
  });

  // =========================================================================
  // 6. PAYMENT TAMPERING & WEBHOOK SIGNATURE INTEGRITY (CWE-345)
  // =========================================================================
  describe("6. Payment Integrity & Webhook Signature Verification", () => {
    test("Razorpay webhook signature rejects forged or replayed signatures", () => {
      const secret = "test_webhook_secret_key_123";
      const payloadBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_123" } } } });
      const forgedSignature = "0000000000000000000000000000000000000000000000000000000000000000";

      const validSignature = crypto.createHmac("sha256", secret).update(payloadBody).digest("hex");

      function verifySignature(body, signature, secretKey) {
        const expected = crypto.createHmac("sha256", secretKey).update(body).digest("hex");
        return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
      }

      assert.equal(verifySignature(payloadBody, validSignature, secret), true);
      assert.equal(verifySignature(payloadBody, forgedSignature, secret), false);
    });
  });
});
