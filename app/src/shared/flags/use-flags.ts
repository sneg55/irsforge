'use client'

import { useConfig } from '../contexts/config-context'

// Phase 6 Stage B — scheduler flags surfaced to the frontend.
//
// `schedulerEnabled` mirrors `scheduler.enabled` from the YAML config.
// When false the oracle scheduler service stays dormant; manual buttons
// are the only path to lifecycle / settle-net / mature actions.
//
// `schedulerManualOverridesEnabled` mirrors `scheduler.manualOverrides
// Enabled`. When false the frontend hides the manual lifecycle / mark-
// publishing / vm-settle buttons (production profile); when true the
// buttons stay visible (demo profile, lets a human drive the demo).
//
// Defaults are intentionally permissive for backward compatibility:
//   - schedulerEnabled defaults false (scheduler not running)
//   - schedulerManualOverridesEnabled defaults true (manual buttons visible)
// — so a config without a `scheduler:` block behaves exactly like
// pre-Phase-6 deployments.
export interface Flags {
  schedulerEnabled: boolean
  schedulerManualOverridesEnabled: boolean
}

export function useFlags(): Flags {
  const { config } = useConfig()
  return {
    schedulerEnabled: config?.scheduler?.enabled ?? false,
    schedulerManualOverridesEnabled: config?.scheduler?.manualOverridesEnabled ?? true,
  }
}
