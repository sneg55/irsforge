import { type NextRequest, NextResponse } from 'next/server'
import { loadResolvedConfig } from '@/shared/config/server'

// Next 16 renamed `middleware` → `proxy`; proxy always runs on the Node.js
// runtime and route-segment config isn't permitted, so only the `matcher`
// export survives the rename (the nodejs runtime is implicit).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

interface RoutingState {
  routing: 'path' | 'subdomain'
  subdomainMap: Record<string, string>
}

let cached: RoutingState | null = null

function getRoutingState(): RoutingState {
  if (cached) return cached
  try {
    const resolved = loadResolvedConfig()
    const subdomainMap: Record<string, string> = {}
    for (const org of resolved.orgs) {
      if (org.subdomain) subdomainMap[org.subdomain] = org.id
    }
    cached = { routing: resolved.routing, subdomainMap }
  } catch (err) {
    // Fail safe: if config can't be loaded, pass everything through rather
    // than rewriting to a guessed org.
    console.warn(
      `[middleware] could not load routing config, defaulting to path mode: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    cached = { routing: 'path', subdomainMap: {} }
  }
  return cached
}

export function proxy(req: NextRequest) {
  const { routing, subdomainMap } = getRoutingState()

  if (routing !== 'subdomain') {
    return NextResponse.next()
  }

  const host = req.headers.get('host') ?? ''
  const hostname = host.split(':')[0]

  // Skip for localhost without subdomain, API routes, and static files
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    req.nextUrl.pathname.startsWith('/api/') ||
    req.nextUrl.pathname.startsWith('/_next/') ||
    req.nextUrl.pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Extract subdomain: goldman.irsforge.example.com → goldman
  const parts = hostname.split('.')
  if (parts.length < 3) return NextResponse.next()
  const subdomain = parts[0]

  const orgId = subdomainMap[subdomain]
  if (!orgId) return NextResponse.next()

  const url = req.nextUrl.clone()
  if (!url.pathname.startsWith(`/org/${orgId}`)) {
    url.pathname = `/org/${orgId}${url.pathname}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}
