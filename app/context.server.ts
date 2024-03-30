import type { AppLoadContext } from '@remix-run/cloudflare'
import { AsyncLocalStorage } from 'node:async_hooks'

export const asyncLocalStorage = new AsyncLocalStorage<AppLoadContext>()

export function getContext(): AppLoadContext {
  const context = asyncLocalStorage.getStore()

  if (!context) {
    throw new Error(
      'No context found. You must be inside the request lifecycle to access "AppLoadContext" context.',
    )
  }

  return context
}

export async function runWithContext<T>(
  context: AppLoadContext,
  fn: () => Promise<T>,
): Promise<T> {
  return asyncLocalStorage.run(context, fn)
}
