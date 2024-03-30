import type { LoaderFunctionArgs } from '@remix-run/cloudflare'

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const shopify = context.shopify
  await shopify.authenticate.admin(request)

  return null
}
