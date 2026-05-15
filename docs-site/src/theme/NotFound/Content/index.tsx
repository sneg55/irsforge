// Shadowed copy of @docusaurus/theme-classic/lib/theme/NotFound/Content.
// The default content is a generic "Page Not Found" with no escape hatch —
// dead-end for anyone who landed here from an external bookmark or typo.
// This version keeps the chrome (Docusaurus Layout still wraps us) and adds:
//   - the path the user actually requested (helps spot a typo)
//   - a section index the user can browse without needing to know slugs
//   - a "report broken link" CTA to GitHub
//
// Swizzle target: theme-classic/NotFound/Content (component-level shadow).
// No `npm run swizzle` was used — Docusaurus auto-detects shadow files at
// src/theme/<ComponentPath>/index.{tsx,jsx,js}.

import clsx from 'clsx'
import { useEffect, useState } from 'react'

const SECTIONS: { label: string; href: string; description: string }[] = [
  {
    label: 'For Judges',
    href: '/judges/quickstart',
    description: 'Five-minute click-through and annotated tour.',
  },
  {
    label: 'Getting Started',
    href: '/getting-started/quickstart',
    description: 'Install, run, see it work locally.',
  },
  {
    label: 'Concepts',
    href: '/concepts/swpm-parity',
    description: 'SWPM parity, topology, CSA model, lifecycle.',
  },
  {
    label: 'Products',
    href: '/products/irs',
    description: 'IRS, OIS, Basis, XCCY, CDS — per-family docs.',
  },
  {
    label: 'Integrators (BYO)',
    href: '/integrators/overview',
    description: 'Auth, oracle, and topology extension recipes.',
  },
  {
    label: 'Reference',
    href: '/reference/config-yaml',
    description: 'YAML config schema, CLI, API endpoints.',
  },
  {
    label: 'Operations',
    href: '/operations/deploying-production',
    description: 'Production deployment, runbook, monitoring.',
  },
  {
    label: 'FAQ',
    href: '/faq',
    description: 'Procurement-grade answers.',
  },
]

function reportIssueUrl(requestedPath: string): string {
  const title = encodeURIComponent(`docs 404: ${requestedPath}`)
  const body = encodeURIComponent(
    [
      `URL: https://docs.irsforge.com${requestedPath}`,
      '',
      'Where I came from (page / search / bookmark / link in another doc):',
      '<!-- describe here -->',
    ].join('\n'),
  )
  return `https://github.com/sneg55/irsforge/issues/new?title=${title}&body=${body}`
}

export default function NotFoundContent({ className }: { className?: string }): JSX.Element {
  // window is undefined during SSR — read pathname after mount so we can show
  // the requested URL back to the user, but render a stable placeholder first
  // so hydration doesn't mismatch.
  const [requestedPath, setRequestedPath] = useState<string>('')
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRequestedPath(window.location.pathname + window.location.search)
    }
  }, [])

  return (
    <main className={clsx('container margin-vert--xl', className)}>
      <div className="row">
        <div className="col col--8 col--offset-2">
          <h1 className="hero__title">Page not found</h1>
          {requestedPath ? (
            <p>
              <code>{requestedPath}</code> isn't a route on this site.
            </p>
          ) : (
            <p>That URL isn't a route on this site.</p>
          )}
          <p>
            Common cause: a deep path that looks nested but isn't. For example,{' '}
            <code>/judges/quickstart/tour</code> is wrong because <em>tour</em> is a sibling of{' '}
            <em>quickstart</em>, not a child page — the correct URL is{' '}
            <a href="/judges/tour">/judges/tour</a>.
          </p>

          <h2>Try one of these sections</h2>
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <a href={s.href}>
                  <strong>{s.label}</strong>
                </a>{' '}
                — {s.description}
              </li>
            ))}
          </ul>

          <h2>Still stuck?</h2>
          <p>
            Use the search box in the header (top right) — every page is indexed. If you arrived
            here from a link somewhere, that link is broken and worth reporting:{' '}
            <a
              href={reportIssueUrl(requestedPath || '<unknown>')}
              target="_blank"
              rel="noopener noreferrer"
            >
              file a GitHub issue
            </a>{' '}
            or jump back to the <a href="/">documentation home</a>.
          </p>
        </div>
      </div>
    </main>
  )
}
