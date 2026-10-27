const { z } = require("zod");
const { isValidTimeZone } = require("../utils/timezone");

// z.string().url() rejects the relative "/uploads/menu-items/xyz.jpg" paths
// returned by our own image upload endpoint (it requires a full absolute
// URL). This accepts either a relative /uploads path or an absolute
// http(s) URL, so pasted external links still work too.
const imageUrlField = z
  .string()
  .max(500)
  .refine((val) => val === "" || val.startsWith("/uploads/") || /^https?:\/\//.test(val), {
    message: "Image must be a relative /uploads path or an absolute http(s) URL",
  });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const onboardingBaseSchema = z.object({
  restaurantName: z.string().trim().min(2).max(100),
  cuisineType: z.string().trim().max(60).optional().default(""),
  adminName: z.string().trim().min(2).max(100),
  adminEmail: z.string().trim().email().max(254),
  adminPassword: z.string().min(10).max(128),
  planKey: z.enum(["BASIC", "STANDARD", "PREMIUM"]),
});
const onboardingTrialSchema = onboardingBaseSchema;
const onboardingCheckoutSchema = onboardingBaseSchema.extend({
  billingPeriod: z.enum(["MONTHLY", "3_MONTHS", "6_MONTHS", "YEARLY"]),
});
const subscriptionVerifySchema = z.object({
  providerOrderId: z.string().trim().min(1).max(100),
  providerPaymentId: z.string().trim().min(1).max(100),
  providerSignature: z.string().trim().min(1).max(200),
});
const subscriptionRenewSchema = z.object({ billingPeriod: z.enum(["MONTHLY", "3_MONTHS", "6_MONTHS", "YEARLY"]) });
const preferredLanguageSchema = z.object({
  language: z.enum(["en", "hi", "te", "ta", "kn", "ml", "bn", "mr", "gu", "pa", "or"]),
});

const restaurantCreateSchema = z.object({
  name: z.string().min(2),
  // Optional — leave it out and the server generates a unique URL slug
  // from the restaurant name automatically (see authService.registerRestaurant).
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase, alphanumeric, hyphens only")
    .optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  serviceChargePercent: z.number().min(0).max(100).optional(),
  currency: z.string().optional(),
  cuisineType: z.string().max(60).optional(),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6),
});

const restaurantUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  cuisineType: z.string().max(60).optional().nullable(),
  taxPercent: z.number().min(0).max(100).optional(),
  serviceChargePercent: z.number().min(0).max(100).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountEnabled: z.boolean().optional(),
  searchEnabled: z.boolean().optional(),
  currency: z.string().optional(),
  logoUrl: imageUrlField.optional().nullable(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),

  // Open / closed
  isOpen: z.boolean().optional(),
  autoScheduleEnabled: z.boolean().optional(),
  openTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use 24h HH:MM, e.g. 10:00")
    .optional()
    .nullable(),
  closeTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use 24h HH:MM, e.g. 23:00")
    .optional()
    .nullable(),
  timezone: z.string().min(1).refine(isValidTimeZone, "Use a valid IANA time zone").optional(),

  // Geofencing
  geofenceEnabled: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  geofenceRadiusMeters: z.number().int().min(20).max(5000).optional(),

  // WhatsApp/SMS
  phoneVerificationEnabled: z.boolean().optional(),
  orderNotificationsEnabled: z.boolean().optional(),
  notificationChannel: z.enum(["whatsapp", "sms"]).optional(),
});

const tableCreateSchema = z.object({
  tableNumber: z.string().min(1),
});

const tableUpdateSchema = z.object({
  tableNumber: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

const categoryCreateSchema = z.object({
  name: z.string().min(1),
  imageUrl: imageUrlField.optional(),
  displayOrder: z.number().int().optional(),
});

const categoryUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  imageUrl: imageUrlField.optional().nullable(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const menuItemCreateSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  imageUrl: imageUrlField.optional().nullable(),
  isVeg: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

const menuItemUpdateSchema = menuItemCreateSchema.partial();

const staffCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  roleId: z.string().uuid().optional(),
}).strict();

const staffInvitationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  roleId: z.string().uuid().optional(),
});
const staffAccessLinkReasonSchema = z.object({ reason: z.string().trim().min(8).max(500) });
const staffPasswordSetSchema = z.object({ password: z.string().min(10).max(72) });

const staffUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  roleId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

const roleCreateSchema = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(200).optional(),
  permissions: z.array(z.string().min(1)).max(100).default([]),
});
const roleUpdateSchema = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  description: z.string().trim().max(200).optional(),
});
const rolePermissionsSchema = z.object({ permissions: z.array(z.string().min(1)).max(100) });
const platformRoleUpdateSchema = z.object({ platformRole: z.enum(["SUPER_ADMIN", "PLATFORM_OPERATIONS", "FINANCE_ADMIN", "SUPPORT_AGENT", "READ_ONLY_AUDITOR"]) });
const platformRestaurantCreateSchema = z.object({
  restaurantName: z.string().trim().min(2).max(100),
  cuisineType: z.string().trim().max(60).optional().default(""),
  ownerName: z.string().trim().min(2).max(100),
  ownerEmail: z.string().trim().email().max(254),
  planKey: z.enum(["BASIC", "STANDARD", "PREMIUM"]),
  reason: z.string().trim().min(8).max(500),
});
const accountActivationSchema = z.object({ password: z.string().min(10).max(72) });

const inventoryConversionSchema = z.object({
  unitName: z.string().trim().min(1).max(24),
  multiplierToBase: z.number().positive().max(1_000_000),
});
const inventoryItemCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sku: z.string().trim().max(50).optional().nullable(),
  baseUnit: z.string().trim().min(1).max(24),
  initialQuantity: z.number().min(0).max(1_000_000_000).default(0),
  lowStockThreshold: z.number().min(0).max(1_000_000_000).default(0),
  conversions: z.array(inventoryConversionSchema).max(20).default([]),
}).superRefine((data, context) => {
  const names = data.conversions.map((conversion) => conversion.unitName.toLowerCase());
  if (new Set(names).size !== names.length || names.includes(data.baseUnit.toLowerCase())) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["conversions"], message: "Use unique conversion units different from the base unit" });
  }
});
const inventoryItemUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  sku: z.string().trim().max(50).optional().nullable(),
  lowStockThreshold: z.number().min(0).max(1_000_000_000).optional(),
  isActive: z.boolean().optional(),
  conversions: z.array(inventoryConversionSchema).max(20).optional(),
});
const inventoryMovementSchema = z.object({
  type: z.enum(["RECEIPT", "ADJUSTMENT", "WASTE"]),
  quantity: z.number().positive().max(1_000_000_000),
  direction: z.enum(["ADD", "REMOVE"]).optional(),
  unit: z.string().trim().max(24).optional(),
  reason: z.string().trim().min(2).max(200),
  idempotencyKey: z.string().uuid(),
}).refine((data) => data.type !== "ADJUSTMENT" || Boolean(data.direction), { message: "Choose whether the adjustment adds or removes stock", path: ["direction"] });
const inventorySupplierCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email().max(254).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});
const inventorySupplierUpdateSchema = inventorySupplierCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "Update at least one supplier field" });
const inventoryPurchaseSchema = z.object({
  supplierId: z.string().uuid().optional().nullable(),
  invoiceNumber: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  purchasedAt: z.string().datetime().optional(),
  idempotencyKey: z.string().uuid(),
  lines: z.array(z.object({
    inventoryItemId: z.string().uuid(),
    quantity: z.number().positive().max(1_000_000_000),
    unit: z.string().trim().max(24).optional(),
    unitCost: z.number().min(0).max(1_000_000_000).optional(),
  })).min(1).max(100),
}).superRefine((data, context) => {
  const ids = data.lines.map((line) => line.inventoryItemId);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "Each stock item can appear once per purchase" });
});
const inventoryReportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
const recipeComponentsSchema = z.object({
  components: z.array(z.object({ inventoryItemId: z.string().uuid(), quantityPerItem: z.number().positive().max(1_000_000) })).max(100),
}).superRefine((data, context) => {
  const ids = data.components.map((component) => component.inventoryItemId);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["components"], message: "Each ingredient can be listed once" });
});

const orderCreateSchema = z
  .object({
    slug: z.string().min(1),
    orderType: z.enum(["DINE_IN", "TAKEAWAY"]),
    // Only required for dine-in — a takeaway order has no table at all.
    tableToken: z.string().uuid().optional(),
    customerName: z.string().min(1).optional(),
    customerPhone: z.string().min(6).optional(),
    // Only required/checked when the restaurant has phoneVerificationEnabled
    // — see orderService.js. Issued by POST /public/restaurants/:slug/otp/verify.
    phoneVerificationToken: z.string().optional(),
    couponCode: z.string().min(1).max(30).optional(),
    // Only read/enforced when the restaurant has geofenceEnabled — see
    // orderService.js. Sent by the client from navigator.geolocation.
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    items: z
      .array(
        z.object({
          menuItemId: z.string().uuid(),
          quantity: z.number().int().positive().max(50),
          instructions: z.string().max(500).optional(),
        })
      )
      .min(1),
  })
  .refine((data) => data.orderType !== "DINE_IN" || !!data.tableToken, {
    message: "tableToken is required for dine-in orders",
    path: ["tableToken"],
  });

const orderStatusSchema = z.object({
  status: z.enum(["ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"]),
});

const manualOrderCreateSchema = z.object({
  orderType: z.enum(["DINE_IN", "TAKEAWAY"]),
  tableId: z.string().uuid().optional(),
  customerName: z.string().trim().max(120).optional(),
  customerPhone: z.string().trim().max(30).optional(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().positive().max(50),
    instructions: z.string().max(500).optional(),
  })).min(1).max(100),
}).refine((data) => data.orderType !== "DINE_IN" || Boolean(data.tableId), {
  message: "An active table is required for dine-in manual orders",
  path: ["tableId"],
});

const addOrderItemsSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().positive().max(50),
        instructions: z.string().max(500).optional(),
      })
    )
    .min(1),
});

const paymentCreateSchema = z.object({
  orderId: z.string().uuid(),
  orderSessionToken: z.string().uuid(),
});

const paymentVerifySchema = z.object({
  orderId: z.string().uuid(),
  orderSessionToken: z.string().uuid(),
  razorpay_order_id: z.string().trim().min(1),
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1),
});

const couponFieldsSchema = z.object({
  code: z
    .string().trim()
    .min(2)
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/, "code must be letters, numbers, hyphens or underscores only"),
  type: z.enum(["PERCENT", "FLAT"]),
  value: z.number().positive(),
  isActive: z.boolean().optional(),
  minOrderAmount: z.number().min(0).optional(),
  maxDiscountAmount: z.number().positive().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

function validateCouponDiscount(data, context) {
  if (data.type === "PERCENT" && data.value !== undefined && data.value > 100) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Percentage discount cannot exceed 100%" });
  }
  if (data.type === "FLAT" && data.maxDiscountAmount != null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["maxDiscountAmount"], message: "A maximum discount cap only applies to percentage coupons" });
  }
}

const couponCreateSchema = couponFieldsSchema.superRefine(validateCouponDiscount);
const couponUpdateSchema = couponFieldsSchema.partial().superRefine(validateCouponDiscount);

const couponValidateSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().min(0),
});

const feedbackCreateSchema = z.object({
  orderSessionToken: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// Accept E.164 digits with an optional leading plus; the OTP service adds
// the plus sign before storing or sending the canonical number.
const phoneSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return value;
  const normalizedDigits = digits.startsWith("00") ? digits.slice(2) : digits;
  return `+${normalizedDigits}`;
}, z.string().regex(/^\+[1-9][0-9]{7,14}$/, "Enter a valid international phone number, e.g. +919876543210"));

const otpSendSchema = z.object({
  phone: phoneSchema,
});

const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

module.exports = {
  loginSchema,
  onboardingTrialSchema,
  onboardingCheckoutSchema,
  subscriptionVerifySchema,
  subscriptionRenewSchema,
  preferredLanguageSchema,
  restaurantCreateSchema,
  restaurantUpdateSchema,
  tableCreateSchema,
  tableUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  menuItemCreateSchema,
  menuItemUpdateSchema,
  staffCreateSchema,
  staffInvitationSchema,
  staffAccessLinkReasonSchema,
  staffPasswordSetSchema,
  staffUpdateSchema,
  roleCreateSchema,
  roleUpdateSchema,
  rolePermissionsSchema,
  platformRoleUpdateSchema,
  platformRestaurantCreateSchema,
  accountActivationSchema,
  inventoryItemCreateSchema,
  inventoryItemUpdateSchema,
  inventoryMovementSchema,
  inventorySupplierCreateSchema,
  inventorySupplierUpdateSchema,
  inventoryPurchaseSchema,
  inventoryReportQuerySchema,
  recipeComponentsSchema,
  orderCreateSchema,
  orderStatusSchema,
  manualOrderCreateSchema,
  addOrderItemsSchema,
  paymentCreateSchema,
  paymentVerifySchema,
  couponCreateSchema,
  couponUpdateSchema,
  couponValidateSchema,
  feedbackCreateSchema,
  otpSendSchema,
  otpVerifySchema,
};
