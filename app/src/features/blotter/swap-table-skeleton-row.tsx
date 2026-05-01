import { Skeleton } from '@/components/ui/skeleton'

export function SkeletonRow({ columnCount }: { columnCount: number }) {
  return (
    <tr className="border-b border-zinc-800/50 bg-zinc-950">
      <td className="w-3 px-1 py-3" />
      {Array.from({ length: columnCount }, (_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-20" />
        </td>
      ))}
    </tr>
  )
}
