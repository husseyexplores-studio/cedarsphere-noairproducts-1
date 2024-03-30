/**
 * Cmd line params:
 *
 * --prod: Run migrations in production (removes --local)
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { readFileSync } from 'node:fs'
import * as toml from '@iarna/toml'

const wranglerConfig = toml.parse(readFileSync('./wrangler.toml', 'utf-8'))
// console.log(wranglerConfig)

/**
 * @typedef {{
 *   binding: string;
 *   database_name: string;
 *   database_id: string
 * }} WranglerDbInfo
 */

const execPromise = promisify(exec)

let cli_args = process.argv.slice(2)

let localArg = '--local'
if (cli_args.includes('--remote')) {
  cli_args = cli_args.filter((x) => x !== '--remote')
  localArg = ''
}

let migratedDbs = {}
execPromise('pnpm exec drizzle-kit generate:sqlite').then(
  async ({ stderr, stdout }) => {
    if (stderr) {
      console.error(stderr)
      return
    }

    if (stdout.includes('nothing to migrate')) {
      console.log('Nothing to migrate!')
      console.log(stdout)
      return
    }

    if (Array.isArray(wranglerConfig?.d1_databases)) {
      const dbs = wranglerConfig.d1_databases

      console.log(`\n* Total wrangler dbs: ${dbs.length} \n`)

      for (let i = 0; i < dbs.length; i++) {
        /** @type {WranglerDbInfo} */
        const dbinfo = dbs[i]

        console.log(
          `(${i}) DB: ${dbinfo.database_name} / (${dbinfo.database_id})`,
        )

        const alreadyMigrated = migratedDbs[dbinfo.database_id]
        if (alreadyMigrated) {
          console.error(`ALREADY MIGRATED`)
          continue
        }

        const result = await execPromise(
          `pnpm exec wrangler d1 execute ${
            dbinfo.database_name
          } ${localArg} --file=$(ls ./drizzle/migrations/*.sql | tail -n 1) ${cli_args.join(
            ' ',
          )}`,
        )

        if (result.stderr) {
          console.error(`FAILED`)
          console.log(result.stderr)
        } else {
          migratedDbs[dbinfo.database_id] = true
          console.error(`SUCCESS`)
          console.log(result.stdout)
        }

        console.log('\n --- \n')
      }
    }
  },
)
