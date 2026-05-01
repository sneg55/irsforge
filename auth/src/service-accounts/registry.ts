import { readFileSync } from 'node:fs'
import bcrypt from 'bcrypt'
import { parse } from 'yaml'
import { type ServiceAccountEntry, serviceAccountsFileSchema } from './schema.js'

// Constant-time equalisation for unknown-client lookups; RFC 6749 §10.6.
// When clientId is not found we still run bcrypt.compare against this hash so
// that an attacker cannot enumerate valid client IDs via response-time analysis.
// The value is a pre-computed bcrypt hash of a throwaway string (cost 10).
const DUMMY_HASH = '$2b$10$SJFMUETBJVU.YkZo/WlgaO43L38Mp9TegkkHizJk87wuBRNyX0JrK'

export class ServiceAccountsRegistry {
  private readonly byId: Map<string, ServiceAccountEntry>

  private constructor(entries: ServiceAccountEntry[]) {
    this.byId = new Map()
    for (const e of entries) {
      if (this.byId.has(e.id)) {
        throw new Error(`ServiceAccounts: duplicate id "${e.id}"`)
      }
      this.byId.set(e.id, e)
    }
  }

  static fromYaml(content: string): ServiceAccountsRegistry {
    let raw: unknown
    try {
      raw = parse(content)
    } catch (err) {
      throw new Error(
        `ServiceAccounts: failed to parse YAML: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    const parsed = serviceAccountsFileSchema.parse(raw)
    return new ServiceAccountsRegistry(parsed.accounts)
  }

  static fromFile(path: string): ServiceAccountsRegistry {
    return ServiceAccountsRegistry.fromYaml(readFileSync(path, 'utf8'))
  }

  async verify(clientId: string, clientSecret: string): Promise<boolean> {
    const entry = this.byId.get(clientId)
    if (!entry) {
      // Run a throwaway compare so timing matches the known-id path.
      // Ignoring the return value is intentional.
      await bcrypt.compare(clientSecret, DUMMY_HASH)
      return false
    }
    return await bcrypt.compare(clientSecret, entry.clientSecretHash)
  }

  has(clientId: string): boolean {
    return this.byId.has(clientId)
  }
}
