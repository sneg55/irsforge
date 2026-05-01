import type { ComparisonRow } from '../components/ComparisonTable.astro'

export const columns = [
  'IRSForge',
  'Fork Daml Finance',
  'Build proprietary',
  'Stay off-chain (CME/LCH)',
] as const

export const rows: ComparisonRow[] = [
  {
    label: 'Time to deploy',
    cells: ['YAML + OIDC', 'Months of integration', '6 to 12 months', 'N/A, already running'],
  },
  {
    label: 'ISDA-shaped templates',
    cells: [
      'Daml Finance V0 swap templates, FpML round-trip',
      'Inherited from Daml Finance',
      'Up to you',
      'Yes (clearing house)',
    ],
  },
  { label: 'FpML 5.x round-trip', cells: ['✓', 'Manual', 'Manual', 'Through clearer'] },
  { label: '24/7 settlement', cells: ['✓', '✓', 'If you build it', '✗ closed weekends'] },
  {
    label: 'Sub-transaction privacy',
    cells: ['✓ Canton', '✓ Canton', '✓ Canton', '✗ cleared, public'],
  },
  { label: 'Open source', cells: ['✓ AGPL v3.0', '✓ Apache 2.0 (Finance only)', '✗', '✗'] },
  {
    label: 'Canton-native',
    cells: ['✓ out-of-box', 'Yes (you wire it)', 'Yes (you wire it)', '✗ off-ledger'],
  },
]
