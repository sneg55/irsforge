'use client'

import { LedgerUnreachable } from '@/components/ui/ledger-unreachable'
import { useLedgerHealth } from '@/shared/hooks/use-ledger-health'
import { AutoPolicyCard } from './components/auto-policy-card'
import { BootstrapStatusCard } from './components/bootstrap-status-card'
import { HealthCard } from './components/health-card'
import { LifecycleEventsCard } from './components/lifecycle-events-card'
import { LifecycleQueueCard } from './components/lifecycle-queue-card'
import { useBootstrapStatus } from './hooks/use-bootstrap-status'

export default function OperatorPage() {
  const ledgerHealth = useLedgerHealth()
  const { totalRows } = useBootstrapStatus()

  // Surface the unreachable panel only when health is genuinely down AND
  // none of the bootstrap queries ever produced rows — placeholderData
  // keeps prior snapshots visible through transient blips. On a fresh
  // load against a half-dead Canton, totalRows stays 0 and the operator
  // sees a clear "Cannot reach the Canton ledger" message instead of the
  // historical silent "Bootstrap incomplete 0/14".
  if (ledgerHealth === 'down' && totalRows === 0) {
    return (
      <div className="space-y-6">
        <LedgerUnreachable message="The operator console can't load bootstrap state, queue, or curve health." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BootstrapStatusCard />
      <LifecycleQueueCard />
      <AutoPolicyCard />
      <LifecycleEventsCard />
      <HealthCard />
    </div>
  )
}
