export type Role = 'customer' | 'staff' | 'manager' | 'admin' | 'owner'

export interface User {
  id: string
  phone_number: string
  phone_verified: boolean
  name: string
  email: string | null
  role: Role
  is_active: boolean
  date_joined: string
}

export const ADMIN_ROLES: readonly Role[] = ['staff', 'manager', 'admin', 'owner']

export function isAdminRole(role: Role | undefined): boolean {
  return role !== undefined && ADMIN_ROLES.includes(role)
}

export interface ApiMetaShape {
  page: number
  limit: number
  total: number
  pages: number
}

export interface Paginated<T> {
  items: T[]
  meta?: ApiMetaShape
}

export interface ProductImage {
  id: string
  url: string
  alt_text: string
  sort_order: number
  renditions: { thumb?: string; medium?: string; full?: string }
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string
  image_url: string
  parent: string | null
  is_active: boolean
  is_system: boolean
  children: Category[]
}

export interface Collection {
  id: string
  name: string
  slug: string
  description: string
  is_active: boolean
}

export interface VariantValue {
  id: string
  option: string
  option_name: string
  value: string
}

export interface VariantOption {
  id: string
  name: string
  values: VariantValue[]
}

export interface ProductVariant {
  id: string
  product: string
  sku: string
  price: string | null
  compare_at_price: string | null
  stock: number
  reserved_stock: number
  available_stock: number
  is_active: boolean
  values: VariantValue[]
}

export interface DiscountBadge {
  id: string
  code: string | null
  name: string
  type: 'percentage' | 'fixed'
  value: string
  percentage: string
  end_date: string | null
}

export interface Product {
  id: string
  name: string
  slug: string
  description?: string
  price: string | null
  compare_at_price: string | null
  sku: string
  barcode?: string
  images: ProductImage[]
  has_variants: boolean
  track_quantity: boolean
  stock: number
  reserved_stock: number
  available_stock: number
  in_stock: boolean
  is_active: boolean
  categories: Category[]
  collections: Collection[]
  discounts: DiscountBadge[]
  discount_percent: number | null
  variants?: ProductVariant[]
  meta_title?: string
  meta_description?: string
  created_at?: string
}

export interface InventoryRow {
  product_id: string
  name: string
  sku: string
  has_variants: boolean
  stock: number
  reserved_stock: number
  available_stock: number
  variants: {
    variant_id: string
    sku: string
    label: string
    stock: number
    reserved_stock: number
    available_stock: number
  }[]
}

export interface InventoryLog {
  id: string
  product: string
  product_name: string
  variant: string | null
  variant_sku: string
  change: number
  reason: string
  reason_label: string
  note: string
  user: string | null
  user_name: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Storefront CMS
//
// `data` arrives normalised from the server (one shape per type, enforced in
// the serializer), so the client never guesses between imageUrl / image_url /
// url the way the reference did.
// ---------------------------------------------------------------------------

export type WidgetType =
  | 'carousel'
  | 'text_block'
  | 'image'
  | 'product_list'
  | 'collection_showcase'
  | 'category_list'
  | 'photo_link_grid'
  | 'hero_cta'
  | 'announcement_bar'
  | 'spacer'
  | 'recently_viewed'
  | 'buy_again'
  | 'recommended_for_you'
  | 'trending_near_you'

export type WidgetLayout = 'grid' | 'slider'

export interface WidgetStyle {
  backgroundColor?: string
  textColor?: string
  paddingY?: 'none' | 'sm' | 'md' | 'lg'
  paddingX?: 'none' | 'sm' | 'md' | 'lg'
  width?: 'full' | 'container'
  borderRadius?: 'none' | 'md' | 'lg'
}

export interface CarouselSlide {
  imageUrl: string
  linkUrl: string
  title: string
  subtitle: string
}

export interface PhotoLinkItem {
  imageUrl: string
  linkUrl: string
  label: string
}

/** The union of every populated `data` shape. Each renderer narrows by type. */
export interface WidgetData {
  // carousel
  slides?: CarouselSlide[]
  carouselStyle?: 'hero' | 'normal'
  // text_block
  content?: string
  // image
  imageUrl?: string
  altText?: string
  linkUrl?: string
  // product_list / personalised / collection_showcase
  title?: string
  productIds?: string[]
  products?: Product[]
  layout?: WidgetLayout
  limit?: number
  // collection_showcase
  collectionId?: string
  collection?: Collection | null
  // category_list
  categoryIds?: string[]
  categories?: Category[]
  // photo_link_grid
  items?: PhotoLinkItem[]
  // hero_cta
  subtitle?: string
  buttonLabel?: string
  buttonUrl?: string
  alignment?: 'start' | 'center' | 'end'
  backgroundImageUrl?: string
  // announcement_bar
  message?: string
  linkLabel?: string
  dismissible?: boolean
  icon?: string
  // spacer
  height?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

export interface Widget {
  id: string
  type: WidgetType
  order: number
  is_active: boolean
  style: WidgetStyle | null
  targeting: Record<string, unknown> | null
  data: WidgetData
}

export interface StorefrontLayoutResponse {
  layout: { id: string; name: string; updated_at: string } | null
  widgets: Widget[]
}

// ---------------------------------------------------------------------------
// Cart, checkout and orders
//
// Every monetary field here is a string computed by the server. The client
// never sends a total and is never believed about one.
// ---------------------------------------------------------------------------

export interface CartLine {
  id: string
  product_id: string
  variant_id: string | null
  name: string
  slug: string
  quantity: number
  unit_price: string
  total_price: string
  variant_label: string
  available_stock: number | null
  image: ProductImage | null
}

export interface CartState {
  id: string | null
  items: CartLine[]
  item_count: number
  subtotal: string
  discount_total: string
  shipping_total: string
  total: string
  discount_code: string
  discount_error: string | null
  region_id: string | null
}

export interface City {
  id: string
  name: string
  code: string
  delivery_fee: string
  is_active: boolean
  region_count: number
}

export interface DeliveryRegion {
  id: string
  name: string
  city: string
  city_name: string
  delivery_fee: string
  estimated_delivery_days: number | null
  is_active: boolean
}

export interface DeliveryMethod {
  id: string
  name: string
  code: string
  description: string
  is_active: boolean
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded'

export interface OrderLine {
  id: string
  product: string
  slug: string
  variant: string | null
  variant_label: string
  quantity: number
  unit_price: string
  total_price: string
  product_name: string
  image: ProductImage | null
}

export interface Order {
  id: string
  order_number: string
  status: OrderStatus
  status_label: string
  shipping_status: string
  shipping_status_label: string
  subtotal: string
  discount_total: string
  shipping_total: string
  delivery_discount_amount: string
  total: string
  payment_method: string
  payment_status: string | null
  delivery_method: string | null
  delivery_method_name: string
  shipping_address: string
  shipping_region: string | null
  region_name: string
  shipping_city: string | null
  city_name: string
  billing_address: string
  customer_notes: string
  tracking_number: string
  tracking_url: string
  items: OrderLine[]
  created_at: string
  user?: { id: string; name: string; phone_number: string } | null
}

export interface Address {
  id: string
  region: string
  region_name: string
  city_name: string
  address: string
  is_default: boolean
}

export interface DashboardStats {
  pending_orders: number
  processing_orders: number
  completed_orders: number
  cancelled_orders: number
  today_orders: number
  month_revenue: string
  revenue_total: string
  customers: number
  low_stock: number
  series: { date: string; orders: number; revenue: string }[]
}

export interface CityAdmin {
  id: string
  name: string
  code: string
  delivery_fee: string
  is_active: boolean
  regions: { id: string; name: string; delivery_fee: string; is_active: boolean }[]
}
