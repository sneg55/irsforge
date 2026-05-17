// Build-time boundary for the analytics gate. Centralises the single
// `process.env.NEXT_PUBLIC_DEPLOY_ENV` read so callers can import a
// typed flag without tripping the lint rule that bans `process.env`
// deep in modules. Webpack inlines `NEXT_PUBLIC_*` at build time, so
// flipping this requires a fresh `next build`, not a runtime env edit.

// eslint-disable-next-line no-restricted-properties -- this file is the single boundary that owns the env read; everything else imports the resolved flag below
const DEPLOY_ENV = process.env.NEXT_PUBLIC_DEPLOY_ENV

export const IS_PRODUCTION_DEPLOY = DEPLOY_ENV === 'production'

export const GA_TRACKING_ID = 'G-8XCRNX21EF'
