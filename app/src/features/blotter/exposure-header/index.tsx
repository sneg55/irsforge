import { Skeleton } from '@/components/ui/skeleton'
import { CollateralZone } from './collateral-zone'
import { RiskZone } from './risk-zone'
import type { ExposureHeaderData } from './types'
import { VolumeZone } from './volume-zone'

interface ExposureHeaderProps {
  data: ExposureHeaderData
  isLoading?: boolean
  csaHref?: string
}

function SkeletonBlock() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3.5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-40" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  )
}

export function ExposureHeaderSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[2fr_1.3fr_1fr] gap-4 items-stretch">
      <SkeletonBlock />
      <SkeletonBlock />
      <SkeletonBlock />
    </div>
  )
}

export function ExposureHeader({ data, isLoading, csaHref }: ExposureHeaderProps) {
  if (isLoading) return <ExposureHeaderSkeleton />
  return (
    <div className="grid grid-cols-1 md:grid-cols-[2fr_1.3fr_1fr] gap-4 items-stretch">
      <RiskZone npv={data.bookNpv} dv01={data.bookDv01} asOf={data.asOf} />
      <VolumeZone
        notional={data.totalNotional}
        activeSwaps={data.activeSwaps}
        swapCountByType={data.swapCountByType}
        asOf={data.asOf}
      />
      <CollateralZone
        configured={data.csa.configured}
        ownPosted={data.csa.ownPosted}
        cptyPosted={data.csa.cptyPosted}
        exposure={data.csa.exposure}
        state={data.csa.state}
        regulatorHints={data.csa.regulatorHints}
        csaHref={csaHref}
      />
    </div>
  )
}
