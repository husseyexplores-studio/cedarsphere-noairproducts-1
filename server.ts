import { type AppLoadContext, logDevReady } from '@remix-run/cloudflare'
import { createPagesFunctionHandler } from '@remix-run/cloudflare-pages'
import * as build from '@remix-run/dev/server-build'
import { initShopify } from '~/shopify.server'
import type { CloudflareEnv } from './types'

if (process.env.NODE_ENV === 'development') {
  logDevReady(build)
}

export const onRequest = createPagesFunctionHandler<CloudflareEnv>({
  build,
  getLoadContext: (context) => {
    const appCtx: AppLoadContext = {
      env: context.env,

      shopify: initShopify(context.env),
      DB: context.env.DB,
      SESSION: context.env.SESSION,
    }

    return appCtx
  },
  mode: build.mode,
})
