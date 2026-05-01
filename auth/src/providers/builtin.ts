import { readFileSync } from 'node:fs'
import bcrypt from 'bcrypt'
import type { Org } from 'irsforge-shared-config'
import { parse } from 'yaml'
import { z } from 'zod'
import type { AuthProvider, AuthRequest, AuthResult } from './interface.js'

const userSchema = z.object({
  username: z.string().min(1),
  passwordHash: z.string().min(1),
  orgId: z.string().min(1),
  actAs: z.array(z.string()).min(1),
  readAs: z.array(z.string()).default([]),
})

const usersFileSchema = z.object({
  users: z.array(userSchema).min(1),
})

type UserEntry = z.infer<typeof userSchema>

export class BuiltinProvider implements AuthProvider {
  private constructor(
    private readonly users: UserEntry[],
    private readonly orgs: Org[],
  ) {}

  static fromUsersYaml(yamlContent: string, orgs: Org[]): Promise<BuiltinProvider> {
    const raw = parse(yamlContent) as unknown
    const { users } = usersFileSchema.parse(raw)
    return Promise.resolve(new BuiltinProvider(users, orgs))
  }

  static fromFile(filePath: string, orgs: Org[]): Promise<BuiltinProvider> {
    const content = readFileSync(filePath, 'utf8')
    return BuiltinProvider.fromUsersYaml(content, orgs)
  }

  async authenticate(req: AuthRequest): Promise<AuthResult> {
    const user = this.users.find((u) => u.username === req.username && u.orgId === req.orgId)

    if (!user) {
      throw new Error('Invalid credentials')
    }

    const passwordMatch = await bcrypt.compare(req.password, user.passwordHash)
    if (!passwordMatch) {
      throw new Error('Invalid credentials')
    }

    const org = this.orgs.find((o) => o.id === req.orgId)
    if (!org) {
      throw new Error('Invalid credentials')
    }

    const readAs = user.readAs.length > 0 ? user.readAs : user.actAs

    return {
      userId: `${user.username}::${user.orgId}`,
      orgId: user.orgId,
      party: org.party,
      actAs: user.actAs,
      readAs,
    }
  }
}
