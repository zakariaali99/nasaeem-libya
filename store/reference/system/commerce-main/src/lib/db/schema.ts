import { relations } from "drizzle-orm";
import { user } from "./auth-schema";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  decimal,
  primaryKey,
  uuid,
  json,
  index,
  uniqueIndex,
  vector,
  char,
  bigint,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// USER MANAGEMENT
export const userAddresses = pgTable("user_addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  regionId: varchar("region_id").notNull().references(() => regions.id),
  address: text("address").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_user_addresses_user_id").on(t.userId),
  index("idx_user_addresses_region_id").on(t.regionId),
]);

// USER MANAGEMENT - Additional tables
export const authLogs = pgTable("auth_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => user.id),
  event: varchar("event", { length: 50 }).notNull(),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_auth_logs_user_id").on(t.userId),
  index("idx_auth_logs_event").on(t.event),
]);

// PRODUCT MANAGEMENT
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  imageUrl: varchar("image_url", { length: 255 }),
  parentId: text("parent_id"),
  isActive: boolean("is_active").default(true).notNull(),
  isSystem: boolean("is_system").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_categories_parent_id").on(t.parentId),
  index("idx_categories_created_at").on(t.createdAt),
]);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
  sku: varchar("sku", { length: 50 }),
  barcode: varchar("barcode", { length: 50 }),
  isActive: boolean("is_active").default(true).notNull(),
  hasVariants: boolean("has_variants").default(false).notNull(),
  trackQuantity: boolean("track_quantity").default(false).notNull(),
  stock: integer("stock").default(0).notNull(),
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  width: integer("width"),  // عرض المنتج بالسم
  length: integer("length"), // طول المنتج بالسم
  height: integer("height"), // ارتفاع المنتج بالسم
  weight: decimal("weight", { precision: 10, scale: 2 }), // وزن المنتج بالكجم
  reservedStock: integer("reserved_stock").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_products_slug").on(t.slug),
  index("idx_products_name").on(t.name),
  index("idx_products_is_active").on(t.isActive),
  index("idx_products_sku").on(t.sku),
  index("idx_products_price").on(t.price),
  index("idx_products_created_at").on(t.createdAt),
  // Full-text search on name and description in Arabic
  //index("idx_products_search").using("gin", sql`to_tsvector('arabic', ${t.name} || ' ' || COALESCE(${t.description}, ''))`),
]);

export const productImages = pgTable("product_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
  url: varchar("url", { length: 255 }).notNull(),
  altText: varchar("alt_text", { length: 100 }),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_product_images_product_id").on(t.productId),
  index("idx_product_images_variant_id").on(t.variantId),
]);

// Product variants
export const variantOptions = pgTable("variant_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Color", "Size"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const variantValues = pgTable("variant_values", {
  id: uuid("id").primaryKey().defaultRandom(),
  optionId: uuid("option_id")
    .notNull()
    .references(() => variantOptions.id, { onDelete: "cascade" }),
  value: varchar("value", { length: 100 }).notNull(), // e.g., "Red", "Blue", "S", "M"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }),
  sku: varchar("sku", { length: 50 }),
  barcode: varchar("barcode", { length: 50 }),
  price: decimal("price", { precision: 10, scale: 2 }),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
  inventoryQuantity: integer("inventory_quantity").default(0).notNull(),
  reservedStock: integer("reserved_stock").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_product_variants_product_id").on(t.productId),
  index("idx_product_variants_is_active").on(t.isActive),
  index("idx_product_variants_sku").on(t.sku),
  index("idx_product_variants_barcode").on(t.barcode),
]);

export const productVariantOptions = pgTable(
  "product_variant_options",
  {
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => variantOptions.id),
    valueId: uuid("value_id")
      .notNull()
      .references(() => variantValues.id),
  },
  (t) => [
    primaryKey({ columns: [t.variantId, t.optionId] }),
    index("idx_product_variant_options_value_id").on(t.valueId),
  ]
);

export const productToCategory = pgTable(
  "product_to_category",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.categoryId] }),
    index("idx_product_to_category_category_id").on(t.categoryId),
  ]
);

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productToCollection = pgTable(
  "product_to_collection",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.collectionId] }),
    index("idx_product_to_collection_collection_id").on(t.collectionId),
  ]
);

// Product related additions

export const productReviews = pgTable("product_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  rating: integer("rating").notNull(),
  review: text("review"),
  isVerifiedPurchase: boolean("is_verified_purchase").default(false),
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_product_reviews_product_id").on(t.productId),
  index("idx_product_reviews_user_id").on(t.userId),
  index("idx_product_reviews_is_approved").on(t.isApproved),
  index("idx_product_reviews_rating").on(t.rating),
  index("idx_product_reviews_created_at").on(t.createdAt),
  // Full-text search on review text
  //index("idx_product_reviews_search").using("gin", sql`to_tsvector('arabic', COALESCE(${t.review}, ''))`),
]);

export const wishlists = pgTable("wishlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idx_wishlists_user_id: index("idx_wishlists_user_id").on(t.userId),
}));

export const wishlistItems = pgTable("wishlist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  wishlistId: uuid("wishlist_id")
    .notNull()
    .references(() => wishlists.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (t) => [
  index("idx_wishlist_items_wishlist_id").on(t.wishlistId),
  index("idx_wishlist_items_product_id").on(t.productId),
]);

// Inventory tracking
export const inventoryTransactions = pgTable("inventory_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").references(() => products.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  quantity: integer("quantity").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // purchase, sale, adjustment, return
  reference: varchar("reference", { length: 100 }), // Order ID or other reference
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_inventory_transactions_product_id").on(t.productId),
  index("idx_inventory_transactions_variant_id").on(t.variantId),
  index("idx_inventory_transactions_created_by").on(t.createdBy),
  index("idx_inventory_transactions_type").on(t.type),
]);

// Notifications system
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // order_update, system, promotion
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_notifications_user_id").on(t.userId),
  index("idx_notifications_read").on(t.read),
  // Conditional index for unread notifications
  //index("idx_notifications_unread").on(t.createdAt).where(sql`${t.read} = false`),
]);

// Email templates for system communications
export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  subject: varchar("subject", { length: 255 }).notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Admin activity logging
export const adminActivityLogs = pgTable("admin_activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: text("admin_id")
    .notNull()
    .references(() => user.id),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(), // product, order, user, etc.
  entityId: text("entity_id"),
  details: json("details"),
  ipAddress: varchar("ip_address", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_admin_activity_logs_admin_id").on(t.adminId),
  index("idx_admin_activity_logs_entity_type").on(t.entityType),
  index("idx_admin_activity_logs_created_at").on(t.createdAt),
]);

// DISCOUNTS
export const discounts = pgTable("discounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).unique(),
  name: varchar("name", { length: 100 }), // Added for display name
  description: text("description"),
  type: varchar("type", { length: 20 }).notNull(), // percentage, fixed, bogo, tiered, delivery
  target: varchar("target", { length: 20 }), // product, variant, order, delivery, region, city
  targetId: uuid("target_id"), // productId, variantId, regionId, cityId, etc.
  value: decimal("value", { precision: 10, scale: 2 }), // For fixed/percentage/tiered
  percentage: decimal("percentage", { precision: 5, scale: 2 }), // For percentage
  bogo: json("bogo"), // { buy: number, get: number, free: boolean }
  tiered: json("tiered"), // [{ minQty, discount }]
  deliveryDiscount: decimal("delivery_discount", { precision: 10, scale: 2 }), // For delivery
  regionId: varchar("region_id"),
  cityId: varchar("city_id"),
  customerSegment: varchar("customer_segment", { length: 150 }),
  isActive: boolean("is_active").default(true).notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }),
  maxDiscountAmount: decimal("max_discount_amount", { precision: 10, scale: 2 }),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_discounts_code").on(t.code),
  index("idx_discounts_is_active").on(t.isActive),
  index("idx_discounts_start_date").on(t.startDate),
  index("idx_discounts_end_date").on(t.endDate),
  index("idx_discounts_target_id").on(t.targetId),
  index("idx_discounts_region_id").on(t.regionId),
  index("idx_discounts_city_id").on(t.cityId),
]);

export const productDiscounts = pgTable(
  "product_discounts",
  {
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
  },
  (t) => [
    primaryKey({ columns: [t.discountId, t.productId] }),
    index("idx_product_discounts_variant_id").on(t.variantId),
  ]
);

export const regionalDiscounts = pgTable(
  "regional_discounts",
  {
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    regionId: varchar("region_id")
      .notNull()
      .references(() => regions.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.discountId, t.regionId] }),
    index("idx_regional_discounts_region_id").on(t.regionId),
  ]
);

export const collectionDiscounts = pgTable(
  "collection_discounts",
  {
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.discountId, t.collectionId] }),
    index("idx_collection_discounts_collection_id").on(t.collectionId),
  ]
);

// REGIONAL DELIVERY
export const cities = pgTable("cities", {
  id: varchar("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  // Index city name for search
  index("idx_cities_name").on(t.name),
]);

export const regions = pgTable("regions", {
  id: varchar("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  cityId: varchar("city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "cascade" }),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull(),
  estimatedDeliveryDays: integer("estimated_delivery_days"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  // Index regions by active status
  index("idx_regions_active").on(t.isActive),
]);

// Example vector index usage for future embedding search
// const items = pgTable('items', { embedding: vector('embedding', { dimensions: 1536 }) }, (t) => [
//   index('idx_items_embedding').using('hnsw', t.embedding.op('vector_cosine_ops'))
// ]);

// DELIVERY METHODS
export const deliveryMethods = pgTable("delivery_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  code: varchar("code", { length: 50 }).notNull().unique(), // For programmatic identification (e.g., 'manual', 'api_service_1')
  description: text("description"),
  isActive: boolean("is_active").default(false).notNull(), // Only one can be active
  configuration: json("configuration"), // Flexible configuration for API keys, endpoints, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_delivery_methods_is_active").on(t.isActive),
]);

// ORDER MANAGEMENT
export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => user.id),
  sessionId: varchar("session_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
}, (t) => [
  index("idx_carts_user_id").on(t.userId),
  index("idx_carts_session_id").on(t.sessionId),
  index("idx_carts_expires_at").on(t.expiresAt),
  // Note: Postgres forbids non-IMMUTABLE functions (like now()) in index predicates.
  // The partial index using `now()` was removed to keep the migration compatible with Postgres.
  // If you need a partial index for active carts, consider adding a boolean `is_active` column
  // or a generated/stored column that can be used in an IMMUTABLE predicate.
]);

export const cartItems = pgTable("cart_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  cartId: uuid("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_cart_items_cart_id").on(t.cartId),
  index("idx_cart_items_product_id").on(t.productId),
]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => user.id),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discountTotal: decimal("discount_total", { precision: 10, scale: 2 }).default("0").notNull(),
  shippingTotal: decimal("shipping_total", { precision: 10, scale: 2 }).default("0"),
  deliveryDiscountAmount: decimal("delivery_discount_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  walletAmountUsed: decimal("wallet_amount_used", { precision: 10, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }),
  deliveryMethodId: uuid("delivery_method_id").references(() => deliveryMethods.id),
  shippingAddress: text("shipping_address"),
  shippingRegionId: varchar("shipping_region_id").references(() => regions.id),
  shippingCityId: varchar("shipping_city_id").references(() => cities.id),
  billingAddress: text("billing_address"),
  customerNotes: text("customer_notes"),
  shippingStatus: varchar("shipping_status", { length: 50 }).default("pending"),
  discountId: uuid("discount_id").references(() => discounts.id),
  referenceId: varchar("reference_id", { length: 100 }),
  trackingNumber: varchar("tracking_number", { length: 100 }),
  trackingUrl: varchar("tracking_url", { length: 255 }),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_orders_user_id").on(t.userId),
  index("idx_orders_status").on(t.status),
  index("idx_orders_shipping_region_id").on(t.shippingRegionId),
  index("idx_orders_shipping_city_id").on(t.shippingCityId),
  index("idx_orders_delivery_method_id").on(t.deliveryMethodId),
  index("idx_orders_created_at").on(t.createdAt),
  index("idx_orders_shipping_status").on(t.shippingStatus),
  // Full-text search on customer notes
  //index("idx_orders_notes_search").using("gin", sql`to_tsvector('arabic', COALESCE(${t.customerNotes}, ''))`),
]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  name: varchar("name", { length: 255 }).notNull(),
  variantTitle: varchar("variant_title", { length: 255 }), // Title of the variant if applicable
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  discountId: uuid("discount_id").references(() => discounts.id),
  lineItemTotal: decimal("line_item_total", { precision: 10, scale: 2 }).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_order_items_order_id").on(t.orderId),
  index("idx_order_items_product_id").on(t.productId),
  index("idx_order_items_variant_id").on(t.variantId),
]);

// PAYMENT INTEGRATION
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("LYD").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  transactionId: varchar("transaction_id", { length: 255 }),
  paymentData: json("payment_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_payments_order_id").on(t.orderId),
  index("idx_payments_status").on(t.status),
]);

// PAYMENT METHOD CONFIGURATIONS
export const paymentMethodConfigurations = pgTable("payment_method_configurations", {
  id: uuid("id").primaryKey().defaultRandom(),
  methodCode: varchar("method_code", { length: 50 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(), // Arabic name for UI
  description: text("description"), // Arabic description for UI
  configData: json("config_data").notNull().default('{}'), // Stores API keys, specific settings
  isEnabled: boolean("is_enabled").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_payment_method_configurations_method_code").on(t.methodCode),
  index("idx_payment_method_configurations_is_enabled").on(t.isEnabled),
]);

// ANALYTICS / TRACKING
export const analyticsIdentities = pgTable("analytics_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  anonymousId: varchar("anonymous_id", { length: 255 }).notNull().unique(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  linkedAt: timestamp("linked_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_analytics_identities_user_id").on(t.userId),
  index("idx_analytics_identities_last_seen_at").on(t.lastSeenAt),
]);

export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  anonymousId: varchar("anonymous_id", { length: 255 }).notNull(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id", { length: 255 }),
  eventName: varchar("event_name", { length: 150 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).default("custom"),
  properties: json("properties").default({}).notNull(),
  context: json("context"),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
}, (t) => [
  index("idx_analytics_events_anonymous_id").on(t.anonymousId),
  index("idx_analytics_events_user_id").on(t.userId),
  index("idx_analytics_events_event_name").on(t.eventName),
  index("idx_analytics_events_occurred_at").on(t.occurredAt),
  //index("idx_analytics_events_properties").using("gin", t.properties),
]);

// ANALYTICS / RFM SEGMENTATION
export const analyticsRfmConfigs = pgTable("analytics_rfm_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(false).notNull(),
  recencyWindowDays: integer("recency_window_days").default(30).notNull(),
  frequencyWindowDays: integer("frequency_window_days").default(90).notNull(),
  monetaryWindowDays: integer("monetary_window_days").default(90).notNull(),
  recencyScale: json("recency_scale").default([]).notNull(),
  frequencyScale: json("frequency_scale").default([]).notNull(),
  monetaryScale: json("monetary_scale").default([]).notNull(),
  weights: json("weights").default({ recency: 1, frequency: 1, monetary: 1 }).notNull(),
  dimensions: json("dimensions").default([]).notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_analytics_rfm_configs_active").on(t.isActive),
  index("idx_analytics_rfm_configs_updated_at").on(t.updatedAt),
]);

export const analyticsRfmScores = pgTable("analytics_rfm_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  configId: uuid("config_id").notNull().references(() => analyticsRfmConfigs.id, { onDelete: "cascade" }),
  windowLabel: varchar("window_label", { length: 20 }).notNull(),
  recencyScore: integer("recency_score").notNull(),
  frequencyScore: integer("frequency_score").notNull(),
  monetaryScore: integer("monetary_score").notNull(),
  totalScore: integer("total_score").notNull(),
  segment: varchar("segment", { length: 80 }).notNull(),
  orderCount: integer("order_count").default(0).notNull(),
  totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).default("0").notNull(),
  lastOrderAt: timestamp("last_order_at"),
  recencyDays: integer("recency_days"),
  metrics: json("metrics").default({}).notNull(),
  dimensions: json("dimensions"),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
  staleAfter: timestamp("stale_after"),
}, (t) => [
  index("idx_analytics_rfm_scores_user_id").on(t.userId),
  index("idx_analytics_rfm_scores_window_label").on(t.windowLabel),
  index("idx_analytics_rfm_scores_config_id").on(t.configId),
  index("idx_analytics_rfm_scores_computed_at").on(t.computedAt),
  uniqueIndex("uidx_analytics_rfm_scores_user_window_config").on(t.userId, t.windowLabel, t.configId),
]);

// RELATIONS
export const userRelations = relations(user, ({ many }) => ({
  userAddresses: many(userAddresses),
  orders: many(orders),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "parentCategory", // Added relation name for clarity
  }),
  children: many(categories, {
    relationName: "subCategories", // Added relation name for clarity
  }),
  productToCategory: many(productToCategory), // Changed from 'products' to 'productToCategory' to be more explicit
}));

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(productVariants),
  images: many(productImages),
  productToCategory: many(productToCategory), // Changed from 'categories' to 'productToCategory'
  discounts: many(productDiscounts),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  images: many(productImages),
  // Relation to the junction table
  variantOptionValues: many(productVariantOptions),
}));

// Relation from the junction table back to variant, option, and value
export const productVariantOptionsRelations = relations(productVariantOptions, ({ one }) => ({
  variant: one(productVariants, {
    fields: [productVariantOptions.variantId],
    references: [productVariants.id],
  }),
  option: one(variantOptions, {
    fields: [productVariantOptions.optionId],
    references: [variantOptions.id],
  }),
  value: one(variantValues, {
    fields: [productVariantOptions.valueId],
    references: [variantValues.id],
  }),
}));

// Relation from option to its values and the junction table
export const variantOptionsRelations = relations(variantOptions, ({ many }) => ({
  values: many(variantValues),
  variantOptionValues: many(productVariantOptions),
}));

// Relation from value back to its option and the junction table
export const variantValuesRelations = relations(variantValues, ({ one, many }) => ({
  option: one(variantOptions, {
    fields: [variantValues.optionId],
    references: [variantOptions.id],
  }),
  variantOptionValues: many(productVariantOptions),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(user, {
    fields: [orders.userId],
    references: [user.id],
  }),
  region: one(regions, {
    fields: [orders.shippingRegionId],
    references: [regions.id],
  }),
  deliveryMethod: one(deliveryMethods, {
    fields: [orders.deliveryMethodId],
    references: [deliveryMethods.id],
  }),
  items: many(orderItems),
  payments: many(payments),
  discount: one(discounts, {
    fields: [orders.discountId],
    references: [discounts.id],
  }),
}));

export const citiesRelations = relations(cities, ({ many }) => ({
  regions: many(regions),
}));

export const regionsRelations = relations(regions, ({ one, many }) => ({
  city: one(cities, {
    fields: [regions.cityId],
    references: [cities.id],
  }),
  discounts: many(regionalDiscounts),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(user, {
    fields: [carts.userId],
    references: [user.id],
  }),
  items: many(cartItems),
}));

export const discountsRelations = relations(discounts, ({ many }) => ({
  products: many(productDiscounts),
  regions: many(regionalDiscounts),
  orders: many(orders),
}));

export const productReviewsRelations = relations(productReviews, ({ one }) => ({
  product: one(products, {
    fields: [productReviews.productId],
    references: [products.id],
  }),
  user: one(user, {
    fields: [productReviews.userId],
    references: [user.id],
  }),
}));

export const wishlistsRelations = relations(wishlists, ({ one, many }) => ({
  user: one(user, {
    fields: [wishlists.userId],
    references: [user.id],
  }),
  items: many(wishlistItems),
}));

export const deliveryMethodsRelations = relations(deliveryMethods, ({ many }) => ({
  orders: many(orders),
}));

// Add relation for productToCategory
export const productToCategoryRelations = relations(productToCategory, ({ one }) => ({
  product: one(products, {
    fields: [productToCategory.productId],
    references: [products.id],
  }),
  category: one(categories, {
    fields: [productToCategory.categoryId],
    references: [categories.id],
  }),
}));

// HOMEPAGE CUSTOMIZATION
export const widgetTypeEnum = [
  'carousel',
  'text_block',
  'image',
  'product_list',
  'collection_showcase',
  'category_list',
  'photo_link_grid',
  'hero_cta',
  'announcement_bar',
  'spacer',
  'recently_viewed',
  'buy_again',
  'recommended_for_you',
  'trending_near_you',
] as const;

export const storefrontLayouts = pgTable("storefront_layouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(), // e.g. "Ramadan Theme", "Default Active"
  isGlobalActive: boolean("is_global_active").default(false).notNull(),
  activeStartDate: timestamp("active_start_date"),
  activeEndDate: timestamp("active_end_date"),
  activeDays: integer("active_days").array(), // 0 = Sunday, 1 = Monday, etc.
  activeStartHour: integer("active_start_hour"),
  activeEndHour: integer("active_end_hour"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const storefrontLayoutsRelations = relations(storefrontLayouts, ({ many }) => ({
  widgets: many(widgets),
}));

export const widgets = pgTable("widgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  layoutId: uuid("layout_id").references(() => storefrontLayouts.id, { onDelete: 'cascade' }), // Nullable briefly for migrations
  type: varchar("type", { length: 50 }).$type<typeof widgetTypeEnum[number]>().notNull(), // 'carousel', 'text_block', 'image', 'product_list', 'collection_showcase', 'category_list', 'product_carousel', 'category_carousel', 'collection_carousel'
  data: json("data").notNull(),
  order: integer("order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  style: json("style"),
  targeting: json("targeting"),
});

export const widgetsRelations = relations(widgets, ({ one }) => ({
  layout: one(storefrontLayouts, {
    fields: [widgets.layoutId],
    references: [storefrontLayouts.id],
  }),
}));

// ============================================================================
// WALLET & LEDGER SYSTEM
// ============================================================================

export const walletAccounts = pgTable("wallet_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  currency: char("currency", { length: 3 }).notNull(),
  currentBalance: bigint("current_balance", { mode: 'number' }).default(0).notNull(), // minor units (e.g. cents)
  status: varchar("status", { length: 20 }).default('active').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uidx_wallet_accounts_user_currency").on(t.userId, t.currency),
]);

export const walletTransactions = pgTable("wallet_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAccountId: uuid("wallet_account_id").notNull().references(() => walletAccounts.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(), // topup|debit|refund|voucher_credit|adjustment
  amount: bigint("amount", { mode: 'number' }).notNull(),    // signed or absolute + type convention
  currency: char("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(), // pending|posted|reversed|failed
  referenceType: varchar("reference_type", { length: 50 }),  // payment_intent|order|voucher|partner_issuance
  referenceId: varchar("reference_id", { length: 128 }),
  idempotencyKey: varchar("idempotency_key", { length: 128 }),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uidx_wallet_txn_idempotency")
    .on(t.walletAccountId, t.idempotencyKey)
    .where(sql`${t.idempotencyKey} IS NOT NULL`), // Requires import { sql } from "drizzle-orm"; -> wait, handled below or import needed.
]);

// ============================================================================
// VOUCHER ENGINE
// ============================================================================

export const voucherCampaigns = pgTable("voucher_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  issuerType: varchar("issuer_type", { length: 20 }).notNull(), // internal|partner
  issuerId: uuid("issuer_id"),
  currency: char("currency", { length: 3 }).notNull(),
  valueType: varchar("value_type", { length: 20 }).notNull(), // fixed|variable
  fixedAmount: bigint("fixed_amount", { mode: 'number' }),
  minAmount: bigint("min_amount", { mode: 'number' }),
  maxAmount: bigint("max_amount", { mode: 'number' }),
  expiresAt: timestamp("expires_at"),
  maxRedemptionsPerCode: integer("max_redemptions_per_code").default(1).notNull(),
  status: varchar("status", { length: 20 }).default('active').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vouchers = pgTable("vouchers", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").notNull().references(() => voucherCampaigns.id, { onDelete: "cascade" }),
  codeHash: char("code_hash", { length: 64 }).notNull(),   // sha256 hex
  codeLast4: varchar("code_last4", { length: 4 }).notNull(),
  amount: bigint("amount", { mode: 'number' }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 20 }).default('active').notNull(), // active|reserved|redeemed|expired|void
  isTest: boolean("is_test").default(false).notNull(),
  partnerId: uuid("partner_id"), // Reference to partner app
  expiresAt: timestamp("expires_at"),
  redeemedByUserId: text("redeemed_by_user_id").references(() => user.id),
  redeemedAt: timestamp("redeemed_at"),
  redemptionTxnId: uuid("redemption_txn_id").references(() => walletTransactions.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uidx_vouchers_code_hash").on(t.codeHash),
]);

// ============================================================================
// B2B PARTNER APPS
// ============================================================================

export const partnerApps = pgTable("partner_apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).default('active').notNull(),
  mode: varchar("mode", { length: 20 }).default('test').notNull(),
  apiKeyId: varchar("api_key_id", { length: 64 }).notNull().unique(), // public identifier
  apiSecretHash: char("api_secret_hash", { length: 64 }).notNull(),      // hash(secret)
  allowedIps: json("allowed_ips"),
  webhookSecretHash: char("webhook_secret_hash", { length: 64 }),
  settledAmount: bigint("settled_amount", { mode: 'number' }).default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  rotatedAt: timestamp("rotated_at"),
});

export const partnerRequestLog = pgTable("partner_request_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  partnerId: uuid("partner_id").notNull().references(() => partnerApps.id, { onDelete: "cascade" }),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  requestHash: char("request_hash", { length: 64 }).notNull(),
  responseCode: integer("response_code").notNull(),
  responseBody: json("response_body"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uidx_partner_req_log_idempotency").on(t.partnerId, t.idempotencyKey),
]);

// ============================================================================
// SECURITY AUDITING
// ============================================================================

export const securityAuditEvents = pgTable("security_audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorType: varchar("actor_type", { length: 20 }).notNull(), // user|partner|admin|system
  actorId: varchar("actor_id", { length: 128 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("target_type", { length: 50 }),
  targetId: varchar("target_id", { length: 128 }),
  ip: varchar("ip", { length: 45 }), // length 45 is enough for IPv6
  userAgent: text("user_agent"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// RELATIONS for new tables
// ============================================================================

export const walletAccountsRelations = relations(walletAccounts, ({ one, many }) => ({
  user: one(user, { fields: [walletAccounts.userId], references: [user.id] }),
  transactions: many(walletTransactions),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  walletAccount: one(walletAccounts, { fields: [walletTransactions.walletAccountId], references: [walletAccounts.id] }),
}));

export const voucherCampaignsRelations = relations(voucherCampaigns, ({ many }) => ({
  vouchers: many(vouchers),
}));

export const vouchersRelations = relations(vouchers, ({ one }) => ({
  campaign: one(voucherCampaigns, { fields: [vouchers.campaignId], references: [voucherCampaigns.id] }),
  redeemedByUser: one(user, { fields: [vouchers.redeemedByUserId], references: [user.id] }),
  redemptionTxn: one(walletTransactions, { fields: [vouchers.redemptionTxnId], references: [walletTransactions.id] }),
  partnerApp: one(partnerApps, { fields: [vouchers.partnerId], references: [partnerApps.id] }),
}));

export const partnerAppsRelations = relations(partnerApps, ({ many }) => ({
  requests: many(partnerRequestLog),
  issuedVouchers: many(vouchers),
}));

export const partnerRequestLogRelations = relations(partnerRequestLog, ({ one }) => ({
  partnerApp: one(partnerApps, { fields: [partnerRequestLog.partnerId], references: [partnerApps.id] }),
}));
