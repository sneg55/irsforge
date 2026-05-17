import { type NextRequest, NextResponse } from 'next/server'
import { loadResolvedConfig } from '@/shared/config/server'

// Canton endpoints that must use GET (not POST). Exact-match only — a
// prefix scan would forward /v1/parties/allocate (POST, creates a party)
// as GET and strip the body. Any new GET endpoint must be added here
// explicitly rather than relying on path prefix.
const GET_PATHS = new Set(['/v1/packages', '/v1/parties'])
const ORG_HEADER = 'x-irsforge-org'

class LedgerProxyError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/**
 * Pull the `org` claim out of a bearer JWT without verifying its signature.
 * Defence in depth — the upstream Canton rejects bad sigs, but we want to
 * short-circuit cross-participant routing here. Returns null for tokens
 * minted without an `org` claim (demo HS256 bootstrap), in which case the
 * proxy can't enforce a binding and must forward.
 */
function readOrgClaimUnverified(authHeader: string | null): string | null {
  if (!authHeader) return null
  const match = /^Bearer\s+(.+)$/i.exec(authHeader)
  if (!match) return null
  const segments = match[1].split('.')
  if (segments.length < 2) return null
  try {
    const payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as {
      org?: unknown
    }
    return typeof payload.org === 'string' ? payload.org : null
  } catch {
    return null
  }
}

function assertOrgBinding(request: NextRequest): void {
  const headerOrg = request.headers.get(ORG_HEADER)
  const tokenOrg = readOrgClaimUnverified(request.headers.get('authorization'))
  if (tokenOrg && headerOrg && tokenOrg !== headerOrg) {
    throw new LedgerProxyError(403, `Org mismatch: token org=${tokenOrg}, header org=${headerOrg}`)
  }
}

/**
 * Forward `init` to `url` and pass the response back verbatim (status, body,
 * and Content-Type). Reads the body as text so non-JSON upstream responses
 * (HTML error pages from a reverse proxy, empty 5xx bodies, plain-text
 * Canton errors) flow through unchanged instead of crashing the route with
 * a `SyntaxError: Unexpected token`. Network-level failures (DNS, refused
 * connection, TLS) surface as a 502 JSON error instead of a 500.
 */
async function proxyToUpstream(url: string, init: RequestInit): Promise<NextResponse> {
  let upstream: Response
  try {
    upstream = await fetch(url, init)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const name = err instanceof Error ? err.name : ''
    // Distinguish timeout (signal-aborted) from other network failures so the
    // UI can render a clearer message. Check both the thrown error name and
    // the signal's aborted flag — jsdom, Node, and browsers disagree on
    // exactly which DOMException surfaces on timer-based abort.
    const timedOut =
      name === 'AbortError' || name === 'TimeoutError' || init.signal?.aborted === true
    if (timedOut) {
      return NextResponse.json(
        { error: `Ledger timeout: upstream did not respond within the configured window` },
        { status: 504 },
      )
    }
    return NextResponse.json({ error: `Ledger unreachable: ${message}` }, { status: 502 })
  }
  const body = await upstream.text()
  const contentType = upstream.headers.get('content-type') ?? 'application/json'
  return new NextResponse(body, {
    status: upstream.status,
    headers: { 'Content-Type': contentType },
  })
}

function resolveLedgerUrl(request: NextRequest): string {
  const config = loadResolvedConfig()
  const orgId = request.headers.get(ORG_HEADER)

  if (orgId) {
    const org = config.orgs.find((o) => o.id === orgId)
    if (!org) throw new LedgerProxyError(400, `Unknown org: ${orgId}`)
    return org.ledgerUrl
  }

  if (config.topology === 'sandbox') {
    return config.orgs[0].ledgerUrl
  }

  throw new LedgerProxyError(400, `Missing ${ORG_HEADER} header (required in network topology)`)
}

export async function POST(request: NextRequest) {
  let upstreamBase: string
  try {
    assertOrgBinding(request)
    upstreamBase = resolveLedgerUrl(request)
  } catch (err) {
    if (err instanceof LedgerProxyError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }

  const { path, body } = (await request.json()) as { path: string; body: unknown }
  const authHeader = request.headers.get('authorization')
  const isGetEndpoint = GET_PATHS.has(path)
  const config = loadResolvedConfig()
  const signal = AbortSignal.timeout(config.ledger.upstreamTimeoutMs)

  return await proxyToUpstream(`${upstreamBase}${path}`, {
    method: isGetEndpoint ? 'GET' : 'POST',
    headers: {
      ...(isGetEndpoint ? {} : { 'Content-Type': 'application/json' }),
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    ...(isGetEndpoint ? {} : { body: JSON.stringify(body) }),
    signal,
  })
}

export async function GET(request: NextRequest) {
  let upstreamBase: string
  try {
    assertOrgBinding(request)
    upstreamBase = resolveLedgerUrl(request)
  } catch (err) {
    if (err instanceof LedgerProxyError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }

  const path = request.nextUrl.searchParams.get('path') ?? '/v1/packages'
  const authHeader = request.headers.get('authorization')
  const config = loadResolvedConfig()
  const signal = AbortSignal.timeout(config.ledger.upstreamTimeoutMs)

  return await proxyToUpstream(`${upstreamBase}${path}`, {
    method: 'GET',
    headers: {
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    signal,
  })
}
