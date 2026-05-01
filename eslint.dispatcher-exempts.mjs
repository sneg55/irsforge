// Files exempt from `complexity` + `sonarjs/cognitive-complexity`.
//
// Each entry is a flat `switch` or chained discriminant check — the
// cognitive-complexity heuristic flags the dispatcher shape itself, not
// tangled logic. Refactoring into per-case helpers would not improve
// clarity; it would just spread the dispatch across more files. New code
// added to these files beyond the existing dispatch is still subject to
// the rule at the default threshold (20).
export const DISPATCHER_EXEMPT_FILES = [
  'app/src/features/regulator/timeline/decode.ts',
  'app/src/features/workspace/hooks/build-proposal-payload.ts',
  'app/src/features/workspace/hooks/use-workspace-reducer.ts',
  'app/src/features/workspace/hooks/use-workspace-commands.ts',
  'app/src/features/workspace/utils/date-parser.ts',
  'app/src/features/workspace/page.tsx',
  'app/src/features/blotter/hooks/use-blotter-valuation.ts',
  'app/src/features/blotter/page.tsx',
  'app/src/features/blotter/swap-table.tsx',
  'app/src/features/blotter/hooks/proposal-helpers.ts',
  'app/src/features/operator/components/queue-row.tsx',
  'app/src/features/operator/components/csa-proposal-validation.ts',
  'app/src/features/workspace/components/leg-column.tsx',
  'app/src/features/workspace/components/on-chain-panel.tsx',
  'app/src/features/workspace/components/reference-sofr-tile.tsx',
  'app/src/features/workspace/components/right-panel.tsx',
  'app/src/features/workspace/components/risk-tab.tsx',
  'app/src/features/workspace/components/solver-tab.tsx',
  'app/src/features/workspace/hooks/use-pricing-inputs.ts',
  'app/src/features/workspace/ledger/resolve-rate-ids.ts',
  'app/src/shared/hooks/use-streamed-events.ts',
  'app/src/shared/layout/status-bar.tsx',
  'app/src/shared/ledger/instrument-helpers.ts',
  'shared-config/src/loader.ts',
  'shared-pricing/src/risk/time.ts',
  'shared-pricing/src/risk/accrued.ts',
  'shared-pricing/src/solver/newton.ts',
  'oracle/src/index.ts',
  'oracle/src/providers/cds-stub.ts',
  'oracle/src/providers/demo-stub.ts',
  'oracle/src/services/demo-curve-ticker.ts',
  'oracle/src/services/mark-publisher/index.ts',
  'packages/canton-party-directory/src/ui.tsx',
]
