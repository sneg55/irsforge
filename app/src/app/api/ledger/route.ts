import { type NextRequest, NextResponse } from 'next/server'
import { loadResolvedConfig } from '@/shared/config/server'

// Canton endpoints that must use GET (not POST)
const GET_ENDPOINTS = ['/v1/packages', '/v1/parties']
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
    upstreamBase = resolveLedgerUrl(request)
  } catch (err) {
    if (err instanceof LedgerProxyError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }

  const { path, body } = (await request.json()) as { path: string; body: unknown }
  const authHeader = request.headers.get('authorization')
  const isGetEndpoint = GET_ENDPOINTS.some((ep) => path.startsWith(ep))
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
