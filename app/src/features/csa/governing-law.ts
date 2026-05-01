import type { GoverningLaw } from '@/shared/ledger/csa-types'

// Display label for a `GoverningLaw` enum value. Reused by the workspace
// CSA tile and the regulator CSA Board card so both surfaces speak the
// same vocabulary ("NY law" / "English law" / "Japanese law").
export function lawDisplay(law: GoverningLaw): string {
  switch (law) {
    case 'NewYork':
      return 'NY law'
    case 'English':
      return 'English law'
    case 'Japanese':
      return 'Japanese law'
  }
}
