import { drizzle } from 'drizzle-orm/d1'

export function initDB(D1DB: D1Database) {
  return drizzle(D1DB)
}

export * as schema from '../drizzle/schema'
