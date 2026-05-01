import type { ClientConfig } from '@/shared/config/client'

// Canonical 4-org fixture used by parties.test demoActAsReadAs cases.
// Extracted into a sibling so the test file stays under the 300-line cap.
export const FULL_ORGS: ClientConfig['orgs'] = [
  {
    id: 'goldman',
    party: 'PartyA',
    displayName: 'Goldman Sachs',
    hint: 'PartyA',
    role: 'trader',
    ledgerUrl: 'http://localhost:7575',
  },
  {
    id: 'jpmorgan',
    party: 'PartyB',
    displayName: 'JPMorgan',
    hint: 'PartyB',
    role: 'trader',
    ledgerUrl: 'http://localhost:7575',
  },
  {
    id: 'operator',
    party: 'Operator',
    displayName: 'Operator',
    hint: 'Operator',
    role: 'operator',
    ledgerUrl: 'http://localhost:7575',
  },
  {
    id: 'regulator',
    party: 'Regulator',
    displayName: 'Regulator',
    hint: 'Regulator',
    role: 'regulator',
    ledgerUrl: 'http://localhost:7575',
  },
]
