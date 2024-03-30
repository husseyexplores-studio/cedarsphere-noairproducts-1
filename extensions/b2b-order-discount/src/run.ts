import type { RunInput, FunctionRunResult } from '../generated/api'
import { DiscountApplicationStrategy } from '../generated/api'

const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
}

type Configuration = {
  title?: string
  thresholds?: DiscountThresholds | undefined
  ensureAnyCustomerTags?: string[]
  excludedProductTags?: string[]
}

type DiscountThresholds = Array<
  [discount_percentage: number, minimum_order_total: number]
>

export function run(input: RunInput): FunctionRunResult {
  const customer = input.cart.buyerIdentity?.customer || null
  if (!customer) return EMPTY_DISCOUNT

  const rawConf = input?.discountNode?.metafield?.value
  const fnconf: Configuration = rawConf ? JSON.parse(rawConf) : null

  let ensureAnyCustomerTags = Array.isArray(fnconf.ensureAnyCustomerTags)
    ? fnconf.ensureAnyCustomerTags
    : []

  if (ensureAnyCustomerTags.length > 0) {
    if (!customer._canUseDiscount) return EMPTY_DISCOUNT
  }

  const maybeThresholds = fnconf?.thresholds
  const discountThresholds = maybeThresholds
    ? getValidatedDiscountThresholds(maybeThresholds)
    : null

  if (!discountThresholds) return EMPTY_DISCOUNT

  // let accessoryCount = 0
  // let accessoryTotalAmount = 0
  const excludedVariantIds: string[] = []
  for (let i = 0, len = input.cart.lines.length; i < len; i++) {
    const line = input.cart.lines[i]
    if (line.merchandise.__typename === 'ProductVariant') {
      const variant = line.merchandise
      if (variant.product._excludedFromDiscount) {
        // accessoryCount += line.quantity
        // accessoryTotalAmount += line.cost.totalAmount.amount
        excludedVariantIds.push(variant.id)
      }
    }
  }

  // If all excluded items in cart - no discount
  if (excludedVariantIds.length === input.cart.lines.length) {
    return EMPTY_DISCOUNT
  }

  const orderSubTotal = +input.cart.cost.subtotalAmount.amount
  const discountPercentage = getDiscount(orderSubTotal, discountThresholds)

  let title = fnconf.title || undefined
  if (title) {
    title += ` (${discountPercentage}%)`
  }

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.First,
    discounts: [
      {
        // message: `B2B (${discountPercentage}%)`,
        message: title,
        targets: [{ orderSubtotal: { excludedVariantIds } }],
        value: { percentage: { value: discountPercentage } },
      },
    ],
  }
}

function getValidatedDiscountThresholds<T>(
  maybeDiscountThreshold: any,
): DiscountThresholds | null {
  if (!maybeDiscountThreshold || !Array.isArray(maybeDiscountThreshold)) {
    return null
  }

  const valid = maybeDiscountThreshold.every((threshold) => {
    if (!Array.isArray(threshold)) return false
    if (threshold.length !== 2) return false

    const perc = +threshold[0]
    const triggerThreshold = +threshold[1]
    if (
      typeof perc !== 'number' ||
      typeof triggerThreshold !== 'number' ||
      Number.isNaN(perc) ||
      Number.isNaN(triggerThreshold)
    )
      return false

    return true
  })

  return valid ? (maybeDiscountThreshold as DiscountThresholds) : null
}

function getDiscount(total: number, discountThresholds: DiscountThresholds) {
  if (Number.isNaN(total) || typeof total !== 'number') return 0

  let discount = 0

  for (let i = discountThresholds.length - 1; i >= 0; i--) {
    const [percentage, minThreshold] = discountThresholds[i]

    if (total >= minThreshold) {
      discount = percentage
      break
    }
  }

  return discount
}

/*

- 5% off for $0 or more order total. (i.e all orders)
- 10% off for $600 or more order total.
- 15% off for $1500 or more order total.
- 20% off for $2500 or more order total.
- 25% off for $5000 or more order total.

const thresholds: DiscountThresholds = [
  [5, 0],
  [10, 600],
  [15, 1500],
  [20, 2500],
  [25, 5000],
]


*/
