import { randomBytes } from 'node:crypto'

interface TokenEntry {
  userId: string
  orgId: string
  actAs: string[]
  readAs: string[]
  expiresAt: number // Unix timestamp in seconds
}

export interface RefreshSession {
  userId: string
  orgId: string
  actAs: string[]
  readAs: string[]
}

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export class RefreshTokenStore {
  private readonly ttlSeconds: number
  private readonly store = new Map<string, TokenEntry>()

  constructor(ttlSeconds: number) {
    this.ttlSeconds = ttlSeconds
  }

  create(userId: string, orgId: string, actAs: string[], readAs: string[]): string {
    const token = generateToken()
    const expiresAt = Math.floor(Date.now() / 1000) + this.ttlSeconds
    this.store.set(token, { userId, orgId, actAs, readAs, expiresAt })
    return token
  }

  validate(token: string): RefreshSession | null {
    const entry = this.store.get(token)
    if (!entry) return null

    const now = Math.floor(Date.now() / 1000)
    if (now >= entry.expiresAt) {
      this.store.delete(token)
      return null
    }

    return {
      userId: entry.userId,
      orgId: entry.orgId,
      actAs: entry.actAs,
      readAs: entry.readAs,
    }
  }

  rotate(oldToken: string): string | null {
    const entry = this.store.get(oldToken)
    if (!entry) return null

    const now = Math.floor(Date.now() / 1000)
    if (now >= entry.expiresAt) {
      this.store.delete(oldToken)
      return null
    }

    this.store.delete(oldToken)
    return this.create(entry.userId, entry.orgId, entry.actAs, entry.readAs)
  }

  revoke(token: string): void {
    this.store.delete(token)
  }
}
