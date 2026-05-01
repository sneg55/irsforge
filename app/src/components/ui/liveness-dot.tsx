import { cn } from '@/lib/utils'

export type LivenessState = 'live' | 'stale' | 'disconnected' | 'idle'

const VARIANT: Record<LivenessState, string> = {
  live: 'bg-green-500 animate-pulse',
  stale: 'bg-amber-500 animate-pulse',
  disconnected: 'bg-red-500',
  idle: 'bg-zinc-600',
}

const STATE_LABEL: Record<LivenessState, string> = {
  live: 'Live',
  stale: 'Refreshing',
  disconnected: 'Disconnected',
  idle: 'Idle',
}

const STATE_DESCRIPTION: Record<LivenessState, string> = {
  live: 'Subscribed to the Canton ledger. Data updates as new contracts are committed.',
  stale: 'Refetching from the ledger. The number you see may be a few seconds behind.',
  disconnected: 'Lost connection to the ledger. Reload the page or check the dev server.',
  idle: 'Not subscribed yet. Data is a one-shot snapshot, not live.',
}

export function LivenessDot({
  state,
  title,
  className,
  placement = 'bottom',
}: {
  state: LivenessState
  title?: string
  className?: string
  placement?: 'top' | 'bottom'
}) {
  const placementClass = placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
  return (
    <span data-slot="liveness-dot-wrapper" className="group relative inline-flex items-center">
      <span
        data-slot="liveness-dot"
        data-state={state}
        title={title}
        className={cn('inline-block h-1.5 w-1.5 rounded-full', VARIANT[state], className)}
      />
      <span
        role="tooltip"
        data-slot="liveness-tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-30 w-64 -translate-x-1/2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-[11px] font-sans font-normal normal-case tracking-normal shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
          placementClass,
        )}
      >
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block h-1.5 w-1.5 rounded-full', VARIANT[state])} />
          <span className="font-semibold text-zinc-200">{STATE_LABEL[state]}</span>
        </span>
        <span className="mt-1 block text-zinc-400">{STATE_DESCRIPTION[state]}</span>
        {title && title !== STATE_LABEL[state] && (
          <span className="mt-1 block text-zinc-500">{title}</span>
        )}
      </span>
    </span>
  )
}
