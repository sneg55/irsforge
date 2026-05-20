'use client'

import { DEPLOY_ENV } from '@/shared/config/analytics'
import { useConfig } from '@/shared/contexts/config-context'

type Tone = 'prod' | 'demo' | 'sandbox' | 'unknown'

const TONE_CLASS: Record<Tone, string> = {
  prod: 'border-emerald-700/50 text-emerald-300',
  demo: 'border-amber-700/50 text-amber-300',
  sandbox: 'border-sky-700/50 text-sky-300',
  unknown: 'border-zinc-700/50 text-zinc-400',
}

// Compose a chip label + tooltip from the resolved deploy env and config
// profile/topology, so CTO-grade buyers can tell at a glance which network
// the cid above belongs to. Source of truth is the build-time
// NEXT_PUBLIC_DEPLOY_ENV plus the runtime config (`profile`, `topology`).
function deriveChip(
  profile: 'demo' | 'production' | undefined,
  topology: 'sandbox' | 'network' | undefined,
): { label: string; tone: Tone; tooltip: string } {
  const env = DEPLOY_ENV ?? 'local'
  if (profile === 'production' && topology === 'network') {
    return { label: 'PROD', tone: 'prod', tooltip: `Production network — DEPLOY_ENV=${env}` }
  }
  if (topology === 'sandbox') {
    return { label: 'SANDBOX', tone: 'sandbox', tooltip: `Canton sandbox — DEPLOY_ENV=${env}` }
  }
  if (profile === 'demo') {
    return { label: 'DEMO', tone: 'demo', tooltip: `Shared demo profile — DEPLOY_ENV=${env}` }
  }
  return { label: env.toUpperCase(), tone: 'unknown', tooltip: `DEPLOY_ENV=${env}` }
}

interface EnvChipProps {
  className?: string
}

export function EnvChip({ className }: EnvChipProps) {
  const { config } = useConfig()
  const chip = deriveChip(config?.profile, config?.topology)
  return (
    <span
      data-testid="env-chip"
      title={chip.tooltip}
      className={`inline-flex items-center rounded-sm border px-1 font-mono text-[10px] font-semibold uppercase tracking-wider ${TONE_CLASS[chip.tone]} ${className ?? ''}`}
    >
      {chip.label}
    </span>
  )
}
