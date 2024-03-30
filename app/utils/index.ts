export function tryCatch<T, U>(fn: () => T, fallback: U): T | U {
  try {
    return fn()
  } catch (e) {
    return fallback
  }
}

export type B2BDiscountThresholds = Array<[perc: number, minThreshold: number]>

export function validatedb2bDiscountThresholds(
  x: unknown,
): B2BDiscountThresholds | null {
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

  return x as B2BDiscountThresholds
}

export function prettyStringifyb2bThresholdJson(
  json: B2BDiscountThresholds,
): string {
  let str = '[\n'

  for (let i = 0; i < json.length; i++) {
    const tuple = json[i]
    str += '  ['
    for (let j = 0; j < tuple.length; j++) {
      str += tuple[j]

      const isLast = j === tuple.length - 1
      if (!isLast) {
        str += ', '
      }
    }

    str += ']'

    const isLast = i === json.length - 1
    if (!isLast) {
      str += ',\n'
    }
  }

  str += '\n]'

  return str
}

export function tagsToList(x: unknown): string[] {
  if (typeof x === 'string') {
    const rawTags = x.trim().split(',')
    const tags: string[] = []

    for (let i = 0; i < rawTags.length; i++) {
      const tag = rawTags[i].trim()
      if (tag) {
        tags.push(tag)
      }
    }
    return tags
  }

  if (Array.isArray(x) && x.every((x) => typeof x === 'string')) {
    return x
  }

  return []
}

export function getConstructName(x: unknown): string | null {
  const name = x?.constructor?.name
  return typeof name === 'string' ? name : null
}
