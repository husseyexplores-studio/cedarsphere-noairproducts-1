import type { AppLoadContext, EntryContext } from '@remix-run/cloudflare'
import { RemixServer } from '@remix-run/react'
import { isbot } from 'isbot'
import { renderToReadableStream } from 'react-dom/server'
import { runWithContext } from '~/context.server'

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  context: AppLoadContext,
) {
  try {
    return runWithContext(context, async () => {
      const shopify = context.shopify
      shopify.addDocumentResponseHeaders(request, responseHeaders)

      const body = await renderToReadableStream(
        <RemixServer context={remixContext} url={request.url} />,
        {
          signal: request.signal,
          onError(error: unknown) {
            // Log streaming rendering errors from inside the shell
            console.error(error)
            responseStatusCode = 500
          },
        },
      )
      if (isbot(request.headers.get('user-agent'))) {
        await body.allReady
      }

      responseHeaders.set('Content-Type', 'text/html')
      return new Response(body, {
        headers: responseHeaders,
        status: responseStatusCode,
      })
    })
  } catch (e) {
    return new Response('An unexpected error occurred', {
      status: 500,
      statusText: 'Internal Server Error',
    })
  }
}
