import type { DiscountMethod } from '@shopify/discount-app-components'
declare type CloudflareEnv = {
  SHOPIFY_API_KEY: string
  SHOPIFY_API_SECRET: string
  SHOPIFY_APP_URL: string
  SCOPES: string
  SHOP_CUSTOM_DOMAIN: string
  SESSION: KVNamespace
  DB: D1Database
}

export type DiscountBase = {
  _metafield_id?: string | null
  id?: string | null
  legacyResourceId?: number | null
  updatedAt?: string | null

  title: string
  method: DiscountMethod
  code: string
  combinesWith: {
    orderDiscounts: boolean
    productDiscounts: boolean
    shippingDiscounts: boolean
  }
  usageLimit: null | number
  appliesOncePerCustomer: boolean
  startsAt: string
  endsAt: string | null
}

export type ShippingDiscountConfig = {
  title: string
  allow_guest?: boolean
  customer_tags_type: 'include' | 'exclude'
  customer_tags: string[]
  discount_value: number
  discount_type: 'fixed' | 'percentage'
  discount_message?: string
}

export type ShippingDiscount = DiscountBase & {
  configuration: ShippingDiscountConfig
}

export type TieredDiscountConfig = {
  title: string
  thresholds: Array<[perc: number, minThreshold: number]>
  ensureAnyCustomerTags: string[]
  excludedProductTags: string[]
}
export type TieredDiscount = DiscountBase & {
  configuration: TieredDiscountConfig
}
