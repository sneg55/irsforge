import { Skeleton } from '@/components/ui/skeleton'

export function WorkspacePageSkeleton() {
  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-[#1e2235] px-4 py-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-24" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-20" />
        </div>
      </div>
      {/* Reference strip */}
      <div className="flex gap-px bg-[#1e2235] border-b border-[#1e2235]">
        <div className="flex-1 bg-[#0b0e17] px-4 py-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-6 w-28" />
          <Skeleton className="mt-1 h-3 w-24" />
        </div>
        <div className="flex-1 bg-[#0b0e17] px-4 py-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-6 w-28" />
          <Skeleton className="mt-1 h-3 w-24" />
        </div>
      </div>
      {/* Main grid: two leg columns + right panel */}
      <div className="grid flex-1 grid-cols-[1fr_1fr_320px] gap-px bg-[#1e2235]">
        <div className="bg-[#0b0e17] p-4 space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="bg-[#0b0e17] p-4 space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="bg-[#0b0e17] p-4 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-3 w-20" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>
    </div>
  )
}
