import { beforeEach, describe, expect, test, vi } from 'vitest'

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

// The proxy route uses Next.js primitives (NextRequest/NextResponse).
// We test the routing logic: GET vs POST endpoint detection and header forwarding.

const LEDGER_URL = 'http://localhost:7575'

const GET_PATHS = new Set(['/v1/packages', '/v1/parties'])

// Mirror the proxy logic from route.ts for testability. Exact-match only —
// prefix matching would forward /v1/parties/allocate (POST) as GET.
function isGetEndpoint(path: string): boolean {
  return GET_PATHS.has(path)
}

function buildUpstreamRequest(path: string, body: unknown, authHeader: string | null) {
  const isGet = isGetEndpoint(path)
  return {
    url: `${LEDGER_URL}${path}`,
    method: isGet ? 'GET' : 'POST',
    headers: {
      ...(isGet ? {} : { 'Content-Type': 'application/json' }),
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    ...(isGet ? {} : { body: JSON.stringify(body) }),
  }
}

describe('proxy route logic', () => {
  test('/v1/packages uses GET method', () => {
    const req = buildUpstreamRequest('/v1/packages', {}, 'Bearer token')
    expect(req.method).toBe('GET')
    expect(req.headers).not.toHaveProperty('Content-Type')
    expect(req).not.toHaveProperty('body')
  })

  test('/v1/parties uses GET method', () => {
    const req = buildUpstreamRequest('/v1/parties', {}, 'Bearer token')
    expect(req.method).toBe('GET')
  })

  test('/v1/query uses POST method', () => {
    const payload = { templateIds: ['pkg:Swap.Proposal:SwapProposal'] }
    const req = buildUpstreamRequest('/v1/query', payload, 'Bearer token')
    expect(req.method).toBe('POST')
    expect(req.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(req.body!)).toEqual(payload)
  })

  test('/v1/create uses POST method', () => {
    const req = buildUpstreamRequest('/v1/create', { templateId: 'x', payload: {} }, 'Bearer t')
    expect(req.method).toBe('POST')
  })

  test('/v1/exercise uses POST method', () => {
    const req = buildUpstreamRequest('/v1/exercise', { choice: 'Accept' }, 'Bearer t')
    expect(req.method).toBe('POST')
  })

  test('forwards Authorization header', () => {
    const req = buildUpstreamRequest('/v1/query', {}, 'Bearer my-jwt-token')
    expect(req.headers.Authorization).toBe('Bearer my-jwt-token')
  })

  test('omits Authorization when not provided', () => {
    const req = buildUpstreamRequest('/v1/query', {}, null)
    expect(req.headers).not.toHaveProperty('Authorization')
  })

  test('constructs correct upstream URL', () => {
    const req = buildUpstreamRequest('/v1/query', {}, null)
    expect(req.url).toBe('http://localhost:7575/v1/query')
  })

  test('/v1/parties/allocate is a POST endpoint', () => {
    // /v1/parties/allocate is a POST that creates a party; a prefix match
    // against /v1/parties would forward it as GET and strip the body. The
    // proxy must classify by exact path, not by prefix.
    expect(isGetEndpoint('/v1/parties/allocate')).toBe(false)
  })

  test('/v1/parties/<id>/anything is a POST endpoint', () => {
    expect(isGetEndpoint('/v1/parties/foo/bar')).toBe(false)
  })
})

describe('GET endpoint detection', () => {
  test.each([
    ['/v1/packages', true],
    ['/v1/parties', true],
    ['/v1/parties/allocate', false],
    ['/v1/query', false],
    ['/v1/create', false],
    ['/v1/exercise', false],
    ['/v1/fetch', false],
  ])('%s → isGet=%s', (path, expected) => {
    expect(isGetEndpoint(path)).toBe(expected)
  })
})
