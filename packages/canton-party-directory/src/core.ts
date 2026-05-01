import { fetchParties } from './canton-api'
import { extractHint, truncate } from './fallback'
import type { DirectoryConfig, PartyEntry } from './types'

// Re-export so `import { PartyEntry } from 'canton-party-directory'` keeps working
// (this file is the package's `.` entrypoint per package.json/tsup.config.ts).
export type { DirectoryConfig, PartyEntry }

export class PartyDirectory {
  private readonly byIdentifier = new Map<string, PartyEntry>()
  private readonly byHint = new Map<string, PartyEntry>()
  private readonly staticIdentifiers = new Set<string>()
  private readonly staticHints = new Set<string>()
  private readonly config: DirectoryConfig

  constructor(config?: DirectoryConfig) {
    this.config = config ?? {}
    if (config?.entries) {
      for (const entry of config.entries) {
        this.addEntry(entry, true)
      }
    }
  }

  private addEntry(entry: PartyEntry, isStatic: boolean): void {
    if (entry.identifier) {
      if (isStatic) this.staticIdentifiers.add(entry.identifier)
      this.byIdentifier.set(entry.identifier, entry)
    }
    const hint = entry.hint ?? (entry.identifier ? extractHint(entry.identifier) : '')
    if (hint) {
      if (isStatic) {
        this.staticHints.add(hint)
        this.byHint.set(hint, entry)
      } else if (!this.staticHints.has(hint)) {
        // Don't overwrite static config entries (which have business names)
        // with Canton entries (which often just have party hints as displayName)
        this.byHint.set(hint, entry)
      }
    }
  }

  displayName(identifier: string): string {
    if (!identifier) return ''
    const exact = this.byIdentifier.get(identifier)
    if (exact) return exact.displayName
    const hint = extractHint(identifier)
    const byHint = this.byHint.get(hint)
    if (byHint) return byHint.displayName
    if (identifier.includes('::')) return hint
    return truncate(identifier, 10)
  }

  async resolve(identifier: string): Promise<PartyEntry> {
    const existing = this.get(identifier)
    if (existing) return existing
    if (!this.config.ledgerUrl && !this.config.proxyUrl) {
      return { identifier, displayName: this.displayName(identifier) }
    }
    await this.sync()
    return this.get(identifier) ?? { identifier, displayName: this.displayName(identifier) }
  }

  async sync(token?: string): Promise<void> {
    const config = {
      ledgerUrl: this.config.ledgerUrl,
      proxyUrl: this.config.proxyUrl,
      token: token ?? this.config.token,
    }
    const entries = await fetchParties(config)
    for (const entry of entries) {
      if (this.staticIdentifiers.has(entry.identifier)) continue
      // If a static config entry exists for this hint, use its displayName
      const hint = entry.hint ?? extractHint(entry.identifier)
      const staticEntry = hint ? this.byHint.get(hint) : undefined
      if (staticEntry && this.staticHints.has(hint)) {
        this.addEntry({ ...entry, displayName: staticEntry.displayName }, false)
      } else {
        this.addEntry(entry, false)
      }
    }
  }

  register(entries: PartyEntry[]): void {
    for (const entry of entries) {
      this.addEntry(entry, true)
    }
  }

  get(identifier: string): PartyEntry | undefined {
    return this.byIdentifier.get(identifier)
  }

  entries(): PartyEntry[] {
    const out = Array.from(this.byIdentifier.values())
    const coveredHints = new Set<string>()
    for (const entry of out) {
      const hint = entry.hint ?? (entry.identifier ? extractHint(entry.identifier) : '')
      if (hint) coveredHints.add(hint)
    }
    for (const [hint, entry] of this.byHint) {
      if (!coveredHints.has(hint)) out.push(entry)
    }
    return out
  }
}
