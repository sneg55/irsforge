import { cn } from '@/lib/utils'

function messageFor(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.length > 0) return error
  return 'Something went wrong.'
}

export function ErrorState({
  error,
  onRetry,
  retryLabel = 'Retry',
  className,
}: {
  error: unknown
  onRetry: () => void
  retryLabel?: string
  className?: string
}) {
  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn(
        'flex flex-col items-start gap-2 rounded-lg border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200',
        className,
      )}
    >
      <span>{messageFor(error)}</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded border border-rose-800 bg-rose-900/40 px-2.5 py-1 text-xs font-medium text-rose-100 hover:bg-rose-900/60"
      >
        {retryLabel}
      </button>
    </div>
  )
}
