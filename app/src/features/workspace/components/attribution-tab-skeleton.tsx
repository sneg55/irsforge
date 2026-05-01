import { Skeleton } from '@/components/ui/skeleton'

export function AttributionTabSkeleton() {
  return (
    <div className="space-y-2 px-3 py-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}
