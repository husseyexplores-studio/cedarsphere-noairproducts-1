import type { ShippingDiscountConfig, TieredDiscountConfig } from '../../types'
import { tagsToList } from './index'

export class FormValidationErrors extends Error {
  errors: Array<{
    field: Array<string>
    message: string
  }>

  message: string
  private _fieldPrefix?: string
  constructor(message: string, fieldPrefix?: string) {
    super()
    this.message = message
    this.errors = []

    this._fieldPrefix = fieldPrefix
  }

  add(field: string | Array<string>, message: string) {
    const f = Array.isArray(field) ? field : [field]
    if (this._fieldPrefix) {
      f.unshift(this._fieldPrefix)
    }

    this.errors.push({
      field: f,
      message,
    })
  }
}

export function validateShippingDiscountConfig(
  x: any,
  prefix?: string,
): [null, ShippingDiscountConfig | null] | [FormValidationErrors, null] {
  if (!x) return [null, null]
  if (typeof x !== 'object') return [null, null]

  const errors = new FormValidationErrors(
    'Failed to validate shipping discount config',
    prefix,
  )

  // if (x.allow_guest == null) x.allow_guest = false;
  // if (typeof x.allow_guest !== "boolean") {
  //   errors.add("allow_guest", "Must be a boolean");
  // }

  if (
    x.customer_tags_type !== 'include' &&
    x.customer_tags_type !== 'exclude'
  ) {
    errors.add('customer_tags_type', "Must be 'include' or 'exclude'")
  }

  x.customer_tags = tagsToList(x.customer_tags)

  if (!Array.isArray(x.customer_tags)) {
    errors.add('customer_tags', 'Must be an array')
  }

  if (typeof x.discount_value === 'string') {
    x.discount_value = Number(x.discount_value)
  }

  if (typeof x.discount_value !== 'number' || Number.isNaN(x.discount_value)) {
    errors.add('discount_value', 'Must be a number')
  }

  if (x.discount_value < 0) {
    errors.add('discount_value', 'Must be greater than or equal to 0')
  }
  if (x.discount_type !== 'fixed' && x.discount_type !== 'percentage') {
    errors.add('discount_type', "Must be 'fixed' or 'percentage'")
  }

  if (x.discount_type === 'percentage' && x.discount_value > 100) {
    errors.add('discount_value', 'Must be less than or equal to 100')
  }

  if (
    typeof x.discount_message != null &&
    typeof x.discount_message !== 'string'
  ) {
    errors.add('discount_message', 'Must be a string')
  }

  if (typeof x.discount_message === 'string') {
    x.discount_message = x.discount_message.trim()
  }

  if (typeof x.title !== 'string') {
    x.title = ''
  }

  if (errors.errors.length > 0) {
    return [errors, null]
  }


  return [
    null,
    {
      title: x.title,
      allow_guest: x.allow_guest,
      customer_tags_type: x.customer_tags_type,
      customer_tags: x.customer_tags,
      discount_value: x.discount_value,
      discount_type: x.discount_type,
      discount_message: x.discount_message,
    },
  ]
}

export function validateTieredDiscountConfig(
  x: any,
  prefix?: string,
): [null, TieredDiscountConfig | null] | [FormValidationErrors, null] {
  if (!x) return [null, null]
  if (typeof x !== 'object') return [null, null]

  const errors = new FormValidationErrors(
    'Failed to validate tiered discount config',
    prefix,
  )

  const thresholds = validateTieredThresholds(x.thresholds)
  if (!thresholds) {
    errors.add('thresholds', 'Invalid thresholds')
  }

  const ensureAnyCustomerTags = tagsToList(x.ensureAnyCustomerTags)
  const excludedProductTags = tagsToList(x.excludedProductTags)

  if (!Array.isArray(x.ensureAnyCustomerTags)) {
    errors.add('ensureAnyCustomerTags', 'Must be an array')
  }
  if (!Array.isArray(x.excludedProductTags)) {
    errors.add('excludedProductTags', 'Must be an array')
  }

  if (typeof x.title !== 'string') {
    x.title = ''
  }

  if (errors.errors.length > 0) {
    return [errors, null]
  }

  // should never happen - satisfies typescript
  if (!thresholds) {
    return [errors, null]
  }

  return [
    null,
    {
      title: x.title,
      thresholds,
      ensureAnyCustomerTags,
      excludedProductTags,
    },
  ]
}

export function validateTieredThresholds(
  x: unknown,
): TieredDiscountConfig['thresholds'] | null {
  if (typeof x === 'string') {
    x = x.trim()
    try {
      x = x ? JSON.parse(x as string) : []
    } catch (e) {
      return null
    }
  }

  if (!Array.isArray(x)) return null

  for (let i = 0; i < x.length; i++) {
    const tuple = x[i]
    if (!Array.isArray(tuple) || tuple.length !== 2) return null

    let perc = +tuple[0]
    let minThreshold = +tuple[1]

    if (typeof perc !== 'number' || typeof minThreshold !== 'number')
      return null
    if (Number.isNaN(perc) || Number.isNaN(minThreshold)) return null

    if (perc < 0) perc = 0
    if (perc > 100) perc = 100

    if (minThreshold < 0) minThreshold = 0

    tuple[0] = perc
    tuple[1] = minThreshold
  }

  // sort by threshold
  x.sort((a, b) => a[1] - b[1])

  return x as TieredDiscountConfig['thresholds']
}
