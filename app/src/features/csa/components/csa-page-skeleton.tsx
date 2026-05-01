import { Skeleton } from '@/components/ui/skeleton'

const COLUMNS = [
  { key: 'pair', label: 'Pair' },
  { key: 'exposure', label: 'Exposure' },
  { key: 'call', label: 'Call / Return' },
  { key: 'posted', label: 'Posted' },
  { key: 'threshold', label: 'Threshold' },
  { key: 'mta', label: 'MTA' },
  { key: 'rounding', label: 'Rounding' },
  { key: 'state', label: 'State' },
]

function SkeletonRow() {
  return (
    <tr data-slot="csa-skeleton-row" className="border-b border-zinc-800/50 bg-zinc-950">
      {COLUMNS.map((c) => (
        <td key={c.key} className="px-4 py-3">
          <Skeleton className="h-4 w-24" />
        </td>
      ))}
    </tr>
  )
}

export function CsaPageSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-800 bg-zinc-900/50">
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400 text-left"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
