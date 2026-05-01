'use client'

interface Props {
  regulators: readonly string[]
}

/**
 * Passive marker rendered next to the on-chain cid when the workflow has
 * one or more regulator observers. Closes the loop for compliance buyers
 * who otherwise can't see that the trade is observable downstream.
 */
export function RegulatorVisibilityPill({ regulators }: Props) {
  if (regulators.length === 0) return null
  const label =
    regulators.length === 1 ? 'Regulator visible' : `Regulator visible · ${regulators.length}`
  return (
    <span
      data-testid="regulator-visibility-pill"
      className="rounded border border-blue-700/50 bg-blue-900/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-blue-300"
      title={`This swap is observable by ${regulators.length} regulator${regulators.length === 1 ? '' : 's'}.`}
    >
      {label}
    </span>
  )
}
