import type { AppLoadContext } from '@remix-run/cloudflare'
import { restResources } from '@shopify/shopify-api/rest/admin/2023-10'
import {
  AppDistribution,
  DeliveryMethod,
  shopifyApp,
  type LATEST_API_VERSION,
} from '@shopify/shopify-app-remix/server'
import { KVSessionStorage } from '@shopify/shopify-app-session-storage-kv'
import type { CloudflareEnv } from '../types'

declare module '@remix-run/cloudflare' {
  interface AppLoadContext {
    env: CloudflareEnv

    /** Important:
     * The above `env` comes from cloudflare as-is.
     * The following keys are manually added by us in `entry.server.tsx`
     * Any future keys below (not in `env`) must also be added in `entry.server.tsx`
     */
    SESSION: CloudflareEnv['SESSION']
    DB: CloudflareEnv['DB']
    shopify: ReturnType<typeof initShopify>
  }
}

const apiVersion = '2024-01' as typeof LATEST_API_VERSION
export const initShopify = (ctxEnv: AppLoadContext['env']) => {
  const shopify = shopifyApp({
    apiKey: ctxEnv.SHOPIFY_API_KEY,
    apiSecretKey: ctxEnv.SHOPIFY_API_SECRET || '',
    apiVersion,
    scopes: ctxEnv.SCOPES?.split(','),
    appUrl: ctxEnv.SHOPIFY_APP_URL || '',
    authPathPrefix: '/auth',
    sessionStorage: new KVSessionStorage(ctxEnv.SESSION),
    distribution: AppDistribution.SingleMerchant,
    restResources,
    webhooks: {
      APP_UNINSTALLED: {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: '/webhooks',
      },
    },
    hooks: {
      afterAuth: async ({ session }) => {
        shopify.registerWebhooks({ session })
      },
    },
    future: {
      v3_webhookAdminContext: true,
      v3_authenticatePublic: true,
    },
    ...(ctxEnv.SHOP_CUSTOM_DOMAIN
      ? { customShopDomains: [ctxEnv.SHOP_CUSTOM_DOMAIN] }
      : {}),
  })

  return shopify
}
