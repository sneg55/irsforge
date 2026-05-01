import assert from 'node:assert/strict'
import { unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { loadConfig } from '../loader.js'
import { VALID_YAML } from './_helpers.js'

// YAML fixture used only by the three auth-provider env-override tests.
// Those tests switch provider to builtin/oidc via env var; the cross-subtree
// refinement then requires mark-publisher to be present, so we carry it here
// rather than polluting VALID_YAML (which uses provider=demo, a no-op case).
const VALID_YAML_WITH_SERVICE_ACCOUNTS = VALID_YAML.replace(
  'auth:\n  provider: demo',
  'auth:\n  provider: demo\n  serviceAccounts:\n    - id: mark-publisher\n      actAs:\n        - Operator',
)

describe('loadConfig', () => {
  let tmpFile: string
  let tmpFileWithSvcAccounts: string

  before(() => {
    tmpFile = join(tmpdir(), `irsforge-test-${Date.now()}.yaml`)
    writeFileSync(tmpFile, VALID_YAML, 'utf8')
    tmpFileWithSvcAccounts = join(tmpdir(), `irsforge-test-svc-${Date.now()}.yaml`)
    writeFileSync(tmpFileWithSvcAccounts, VALID_YAML_WITH_SERVICE_ACCOUNTS, 'utf8')
  })

  after(() => {
    for (const f of [tmpFile, tmpFileWithSvcAccounts]) {
      try {
        unlinkSync(f)
      } catch {
        // ignore
      }
    }
  })

  it('loads a valid YAML file', () => {
    const config = loadConfig(tmpFile)
    assert.equal(config.topology, 'sandbox')
    assert.equal(config.routing, 'path')
    assert.equal(config.auth.provider, 'demo')
    assert.equal(config.orgs.length, 4)
    assert.equal(config.orgs[0].id, 'goldman')
  })

  it('throws on non-existent file', () => {
    assert.throws(() => loadConfig('/nonexistent/path/irsforge.yaml'), {
      message: /not found|ENOENT/i,
    })
  })

  it('throws on invalid YAML content', () => {
    const badFile = join(tmpdir(), `irsforge-bad-${Date.now()}.yaml`)
    writeFileSync(badFile, 'topology: cloud\norgs: []\nauth:\n  provider: demo\n', 'utf8')
    assert.throws(() => loadConfig(badFile))
    unlinkSync(badFile)
  })

  it('applies IRSFORGE_TOPOLOGY env override', () => {
    process.env['IRSFORGE_TOPOLOGY'] = 'network'
    try {
      const config = loadConfig(tmpFile)
      assert.equal(config.topology, 'network')
    } finally {
      delete process.env['IRSFORGE_TOPOLOGY']
    }
  })

  it('applies IRSFORGE_ROUTING env override (with template)', () => {
    // Subdomain routing requires a template; set both env vars.
    process.env['IRSFORGE_ROUTING'] = 'subdomain'
    process.env['IRSFORGE_FRONTEND_URL_TEMPLATE'] = 'http://{subdomain}.localhost:3000'
    try {
      const config = loadConfig(tmpFile)
      assert.equal(config.routing, 'subdomain')
      assert.equal(config.platform.frontendUrlTemplate, 'http://{subdomain}.localhost:3000')
    } finally {
      delete process.env['IRSFORGE_ROUTING']
      delete process.env['IRSFORGE_FRONTEND_URL_TEMPLATE']
    }
  })

  it('applies IRSFORGE_AUTH_PROVIDER env override', () => {
    process.env['IRSFORGE_AUTH_PROVIDER'] = 'builtin'
    process.env['IRSFORGE_BUILTIN_ISSUER'] = 'http://localhost:3002'
    try {
      const config = loadConfig(tmpFileWithSvcAccounts)
      assert.equal(config.auth.provider, 'builtin')
      assert.equal(config.auth.builtin?.issuer, 'http://localhost:3002')
    } finally {
      delete process.env['IRSFORGE_AUTH_PROVIDER']
      delete process.env['IRSFORGE_BUILTIN_ISSUER']
    }
  })

  it('applies IRSFORGE_OIDC_* env overrides', () => {
    process.env['IRSFORGE_AUTH_PROVIDER'] = 'oidc'
    process.env['IRSFORGE_BUILTIN_ISSUER'] = 'http://localhost:3002'
    process.env['IRSFORGE_OIDC_AUTHORITY'] = 'https://auth.example.com'
    process.env['IRSFORGE_OIDC_CLIENT_ID'] = 'my-client'
    process.env['IRSFORGE_OIDC_CLIENT_SECRET'] = 'my-secret'
    try {
      const config = loadConfig(tmpFileWithSvcAccounts)
      assert.equal(config.auth.provider, 'oidc')
      assert.equal(config.auth.oidc?.authority, 'https://auth.example.com')

      assert.equal(config.auth.oidc?.clientId, 'my-client')

      assert.equal(config.auth.oidc?.clientSecret, 'my-secret')
    } finally {
      delete process.env['IRSFORGE_AUTH_PROVIDER']
      delete process.env['IRSFORGE_BUILTIN_ISSUER']
      delete process.env['IRSFORGE_OIDC_AUTHORITY']
      delete process.env['IRSFORGE_OIDC_CLIENT_ID']
      delete process.env['IRSFORGE_OIDC_CLIENT_SECRET']
    }
  })

  it('applies IRSFORGE_BUILTIN_ISSUER env override', () => {
    process.env['IRSFORGE_AUTH_PROVIDER'] = 'builtin'
    process.env['IRSFORGE_BUILTIN_ISSUER'] = 'http://auth-svc:3002'
    try {
      const config = loadConfig(tmpFileWithSvcAccounts)
      assert.equal(config.auth.builtin?.issuer, 'http://auth-svc:3002')
    } finally {
      delete process.env['IRSFORGE_AUTH_PROVIDER']
      delete process.env['IRSFORGE_BUILTIN_ISSUER']
    }
  })
})
