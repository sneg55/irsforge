'use client'

import { AutoPolicyCard } from './components/auto-policy-card'
import { BootstrapStatusCard } from './components/bootstrap-status-card'
import { HealthCard } from './components/health-card'
import { LifecycleEventsCard } from './components/lifecycle-events-card'
import { LifecycleQueueCard } from './components/lifecycle-queue-card'

export default function OperatorPage() {
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
