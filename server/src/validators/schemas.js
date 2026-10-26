const { z } = require("zod");

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
  timezone: z.string().optional(),

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
  password: z.string().min(6),
  roleId: z.string().uuid().optional(),
});

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
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

const couponCreateSchema = z.object({
  code: z
    .string()
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

const couponUpdateSchema = couponCreateSchema.partial();

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
  restaurantCreateSchema,
  restaurantUpdateSchema,
  tableCreateSchema,
  tableUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  menuItemCreateSchema,
  menuItemUpdateSchema,
  staffCreateSchema,
  staffUpdateSchema,
  roleCreateSchema,
  roleUpdateSchema,
  rolePermissionsSchema,
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
