import type { RunInput, FunctionRunResult } from '../generated/api'
// import { } from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = {
  discounts: [],
}

type Configuration = {
  title?: string
  allow_guest?: boolean
  customer_tags_type: 'include' | 'exclude'
  customer_tags: string[]
  discount_value: number
  discount_type: 'fixed' | 'percentage'
  discount_message?: string
}

export function run(input: RunInput): FunctionRunResult {
  const rawConf = input?.discountNode?.metafield?.value
  const fnconf: Configuration = rawConf ? JSON.parse(rawConf) : null
  if (!fnconf) return EMPTY_DISCOUNT

  const discount_value = +fnconf.discount_value
  const discount_type = fnconf.discount_type
  if (discount_type !== 'percentage' && discount_type !== 'fixed')
    return EMPTY_DISCOUNT

  if (typeof discount_value !== 'number' || Number.isNaN(discount_value))
    return EMPTY_DISCOUNT

  if (discount_value < 0) return EMPTY_DISCOUNT
  if (discount_type === 'percentage' && discount_value > 100)
    return EMPTY_DISCOUNT

  // const allow_guest = fnconf.allow_guest ?? false
  const allow_guest = false
  const customer = input.cart.buyerIdentity?.customer || null

  if (!allow_guest) {
    if (!customer) return EMPTY_DISCOUNT
  }

  if (fnconf.customer_tags_type === 'include') {
    // customer must be logged in
    if (!customer) return EMPTY_DISCOUNT

    // Tags are not defined? nobody is getting a discount.
    // Tags must be defined when "include"
    if (fnconf.customer_tags.length === 0) return EMPTY_DISCOUNT
    if (!customer._hasTag) return EMPTY_DISCOUNT
  } else if (fnconf.customer_tags_type === 'exclude') {
    if (customer && customer._hasTag) return EMPTY_DISCOUNT
  } else {
    return EMPTY_DISCOUNT
  }



  let title = fnconf.title || undefined
  if (discount_type === 'percentage') {
    title += ` (${discount_value}%)`
  }

  return {
    discounts: [
      {
        message: title,
        targets: input.cart.deliveryGroups.map((group) => ({
          deliveryGroup: { id: group.id },
        })),
        value:
          discount_type === 'fixed'
            ? { fixedAmount: { amount: discount_value } }
            : { percentage: { value: discount_value } },
      },
    ],
  }
}
