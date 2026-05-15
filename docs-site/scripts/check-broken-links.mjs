#!/usr/bin/env node
// Two-pass link checker for docs-site/build/:
//
//   Pass 1 (internal): walks every built HTML page, extracts every internal
//   href, validates the target resolves to a real built file. Catches MDX
//   raw <a href>, sidebar drift, and other things Docusaurus's built-in
//   `onBrokenLinks: 'throw'` doesn't see (only markdown-resolved links go
//   through that hook).
//
//   Pass 2 (cross-site): walks site/src/ (the marketing site), finds every
//   `docs.irsforge.com/<path>` reference, validates each path against the
//   built route inventory. Catches drift between the marketing site's hard-
//   coded URLs and what the docs site actually serves.
//
// Also writes docs-site/build/routes.json — a flat list of every route the
// build emitted. Anything else that needs to lint links against the docs
// (decks, scripts) can read this file.
//
// Exit 0 = clean, 1 = broken links found, 2 = script error.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BUILD_DIR = path.resolve(__dirname, '..', 'build')
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SITE_SRC_DIR = path.join(REPO_ROOT, 'site', 'src')
const ROUTES_OUTPUT = path.join(BUILD_DIR, 'routes.json')

async function walk(dir, out = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(full, out)
    else if (entry.name.endsWith('.html')) out.push(full)
  }
  return out
}

const HREF_RE = /\bhref=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi

function extractHrefs(html) {
  const out = []
  for (const m of html.matchAll(HREF_RE)) {
    out.push(m[1] ?? m[2] ?? m[3])
  }
  return out
}

function isExternal(href) {
  return /^(https?:|mailto:|tel:|ftp:)/i.test(href)
}

function normalizeInternal(href, fromUrl) {
  // Strip query + hash for resolution; remember the hash for anchor checks.
  let target = href
  let hash = ''
  const hashIdx = target.indexOf('#')
  if (hashIdx !== -1) {
    hash = target.slice(hashIdx + 1)
    target = target.slice(0, hashIdx)
  }
  const qIdx = target.indexOf('?')
  if (qIdx !== -1) target = target.slice(0, qIdx)

  if (!target) return { path: fromUrl, hash, raw: href }

  // Absolute path
  if (target.startsWith('/')) return { path: target, hash, raw: href }

  // Relative — resolve against the from-url's directory.
  const base = fromUrl.endsWith('/') ? fromUrl : `${path.posix.dirname(fromUrl)}/`
  const resolved = path.posix.resolve(base, target)
  return { path: resolved, hash, raw: href }
}

function urlFromHtmlPath(htmlPath) {
  const rel = path.relative(BUILD_DIR, htmlPath).split(path.sep).join('/')
  if (rel === 'index.html') return '/'
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`
  return `/${rel.replace(/\.html$/, '')}`
}

async function resolvesToFile(urlPath) {
  // Try both trailing-slash conventions Docusaurus may emit.
  const candidates = []
  const cleaned = urlPath.replace(/\/+$/, '') // strip trailing slash
  // `/foo` → build/foo/index.html OR build/foo.html
  candidates.push(path.join(BUILD_DIR, cleaned, 'index.html'))
  candidates.push(path.join(BUILD_DIR, `${cleaned}.html`))
  // Root case
  if (cleaned === '') candidates.push(path.join(BUILD_DIR, 'index.html'))
  for (const c of candidates) {
    try {
      const st = await fs.stat(c)
      if (st.isFile()) return c
    } catch {
      /* not present, try next */
    }
  }
  return null
}

async function main() {
  const htmlFiles = await walk(BUILD_DIR)
  const seen = new Map() // url -> resolved file path or null
  const broken = [] // { from, raw, resolvedPath }

  for (const file of htmlFiles) {
    const fromUrl = urlFromHtmlPath(file)
    const html = await fs.readFile(file, 'utf-8')
    for (const href of extractHrefs(html)) {
      if (!href || isExternal(href) || href.startsWith('#') || href.startsWith('//')) continue
      if (href.startsWith('data:') || href.startsWith('javascript:')) continue
      const { path: target, hash, raw } = normalizeInternal(href, fromUrl)
      // Skip asset paths — they aren't HTML routes.
      if (
        target.startsWith('/assets/') ||
        target.startsWith('/_astro/') ||
        target.startsWith('/img/') ||
        target.startsWith('/fonts/') ||
        target.endsWith('.svg') ||
        target.endsWith('.png') ||
        target.endsWith('.jpg') ||
        target.endsWith('.webp') ||
        target.endsWith('.ico') ||
        target.endsWith('.js') ||
        target.endsWith('.css') ||
        target.endsWith('.woff2') ||
        target.endsWith('.xml')
      ) {
        continue
      }
      // Cache HTML existence per URL.
      let resolved = seen.get(target)
      if (resolved === undefined) {
        resolved = await resolvesToFile(target)
        seen.set(target, resolved)
      }
      if (!resolved) {
        broken.push({ from: fromUrl, raw, resolvedTarget: target, hash })
      }
    }
  }

  // Dedup broken results on (resolvedTarget, from) pair so we don't repeat
  // the navbar appearing on every page.
  const dedupKey = (b) => `${b.from}\t${b.resolvedTarget}`
  const dedup = new Map()
  for (const b of broken) {
    if (!dedup.has(dedupKey(b))) dedup.set(dedupKey(b), b)
  }
  const final = [...dedup.values()].sort(
    (a, b) => a.resolvedTarget.localeCompare(b.resolvedTarget) || a.from.localeCompare(b.from),
  )

  // Group by target to highlight high-impact breaks.
  const byTarget = new Map()
  for (const b of final) {
    if (!byTarget.has(b.resolvedTarget)) byTarget.set(b.resolvedTarget, [])
    byTarget.get(b.resolvedTarget).push(b.from)
  }

  console.log(`Internal: scanned ${htmlFiles.length} pages.`)
  if (final.length === 0) {
    console.log('  OK: no broken internal links.')
  } else {
    console.log(
      `  FAIL: ${final.length} broken-link occurrences across ${byTarget.size} unique targets:\n`,
    )
    for (const [target, fromList] of [...byTarget.entries()].sort()) {
      console.log(`    ${target}`)
      console.log(
        `      ${fromList.length} page(s): ${fromList.slice(0, 3).join(', ')}${fromList.length > 3 ? ` +${fromList.length - 3} more` : ''}`,
      )
    }
  }

  // ----- Pass 2: cross-site references from marketing site ---------------
  // Build a route inventory from what Pass 1 already discovered (the html
  // files we walked are the authoritative list of what's served).
  const routes = htmlFiles.map((f) => urlFromHtmlPath(f)).sort()
  await fs.writeFile(ROUTES_OUTPUT, `${JSON.stringify(routes, null, 2)}\n`, 'utf-8')
  console.log(
    `Wrote route inventory (${routes.length} routes) → ${path.relative(REPO_ROOT, ROUTES_OUTPUT)}`,
  )

  // Normalize both sides on lookup: urlFromHtmlPath emits trailing slashes
  // for nested routes (`/foo/bar/`) but external refs typically don't. Strip
  // trailing slashes in the route set and on every lookup so a marketing-
  // site `https://docs.irsforge.com/foo/bar` matches `/foo/bar/` in routes.
  const routeSet = new Set(routes.map((r) => r.replace(/\/+$/, '') || '/'))
  const routeMatches = (p) => {
    const cleaned = p.replace(/\/+$/, '') || '/'
    return routeSet.has(cleaned)
  }

  const externalBroken = await scanCrossSiteRefs(SITE_SRC_DIR, routeMatches)

  console.log(
    `\nCross-site: scanned ${SITE_SRC_DIR.replace(`${REPO_ROOT}/`, '')} for docs.irsforge.com refs.`,
  )
  if (externalBroken.length === 0) {
    console.log('  OK: every referenced docs path resolves to a built route.')
  } else {
    console.log(`  FAIL: ${externalBroken.length} stale reference(s):`)
    for (const b of externalBroken) {
      console.log(`    ${b.urlPath}`)
      console.log(`      ${b.file}:${b.line}`)
    }
  }

  const totalFailures = final.length + externalBroken.length
  process.exit(totalFailures === 0 ? 0 : 1)
}

async function scanCrossSiteRefs(srcDir, routeMatches) {
  // Bail quietly if the marketing site isn't present (running from a
  // worktree that only checked out docs-site, for example). We don't want
  // missing-dir to count as a failure.
  try {
    await fs.access(srcDir)
  } catch {
    console.log(`\nCross-site: ${srcDir} not present — skipping.`)
    return []
  }
  const files = []
  await collectFiles(srcDir, files, /\.(astro|tsx?|jsx?|md|mdx|html)$/i)
  const docsUrlRe = /https?:\/\/docs\.irsforge\.com(\/[a-z0-9/_\-#?=&%.]*)?/gi
  const broken = []
  for (const file of files) {
    const txt = await fs.readFile(file, 'utf-8')
    const lines = txt.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      for (const m of line.matchAll(docsUrlRe)) {
        let urlPath = m[1] ?? '/'
        // Strip query + hash for routing check.
        urlPath = urlPath.split('#')[0].split('?')[0]
        if (!urlPath) urlPath = '/'
        if (!routeMatches(urlPath)) {
          broken.push({
            file: path.relative(REPO_ROOT, file),
            line: i + 1,
            urlPath,
          })
        }
      }
    }
  }
  return broken
}

async function collectFiles(dir, out, filterRe) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await collectFiles(full, out, filterRe)
    else if (filterRe.test(entry.name)) out.push(full)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
