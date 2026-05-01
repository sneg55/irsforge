import { resolve } from 'node:path'
import { type Config, loadConfig } from 'irsforge-shared-config'

// The app uses the same resolved shape as auth — no local schema, no env
// parsing. All env overrides and zod validation live in `irsforge-shared-config`
// so every service sees identical behavior. See
// docs/superpowers/plans/2026-04-13-config-loader-consolidation.md.
export type ResolvedConfig = Config

function configPath(): string {
  return process.env.IRSFORGE_CONFIG_PATH ?? resolve(process.cwd(), '../irsforge.yaml')
}

export function loadResolvedConfig(): ResolvedConfig {
  return loadConfig(configPath())
}
