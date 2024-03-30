import { useState } from 'react'
import type { HeadersFunction, LoaderFunctionArgs } from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import { Link, Outlet, useLoaderData, useRouteError } from '@remix-run/react'
import { Provider as AppBridgeReactProvider } from '@shopify/app-bridge-react'
import { DiscountProvider } from '../components/providers/DiscountProvider'
import polarisStyles from '@shopify/polaris/build/esm/styles.css'
import { boundary } from '@shopify/shopify-app-remix/server'
import { AppProvider } from '@shopify/shopify-app-remix/react'
import { getConstructName } from '~/utils/index'

export const links = () => [{ rel: 'stylesheet', href: polarisStyles }]

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const shopify = context.shopify
  await shopify.authenticate.admin(request)

  const url = new URL(request.url)

  return json({
    apiKey: context.env.SHOPIFY_API_KEY || '',
    host: url.searchParams.get('host') || '',
  })
}

export default function App() {
  const { apiKey, host } = useLoaderData<typeof loader>()
  const [config] = useState({ host, apiKey })

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <AppBridgeReactProvider config={config}>
        <DiscountProvider ianaTimezone="America/Chicago">
          <ui-nav-menu>
            <Link to="/app" rel="home">
              Home
            </Link>
            {/* <Link to="/app/additional">Additional page</Link> */}
          </ui-nav-menu>
          <Outlet />
        </DiscountProvider>
      </AppBridgeReactProvider>
    </AppProvider>
  )
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const routeError = useRouteError()
  try {
    return boundary.error(routeError)
  } catch (e) {
    const constructorName = getConstructName(e) || '<Unknown Constructor>'

    const errorMsg =
      e instanceof Error
        ? e.message
        : routeError instanceof Error
          ? routeError.message
          : 'Unknown error.'

    return (
      <div>
        <h2>Something went wrong</h2>
        <p>{errorMsg}</p>

        <pre>{JSON.stringify(e, null, 2)}</pre>
        <pre>{JSON.stringify(routeError, null, 2)}</pre>

        {/* prettier-ignore */}
        <pre>
          route                 : app
          error constructor name: {constructorName}
        </pre>
      </div>
    )
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs)
}
