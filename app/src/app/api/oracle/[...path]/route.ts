import { type NextRequest, NextResponse } from 'next/server'
import { loadResolvedConfig } from '@/shared/config/server'

interface RouteContext {
  params: Promise<{ path: string[] }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const config = loadResolvedConfig()
    const { path } = await params
    const upstream = `${config.oracle.url}/api/${path.join('/')}`

    const res = await fetch(upstream, { method: 'GET' })
    const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
    const body = await res.text()

    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': contentType },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Oracle unreachable: ${message}` }, { status: 502 })
  }
}
