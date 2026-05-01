// YAML config fixtures for route.test.ts — extracted to keep the test file under
// the 300-line limit after Task 1 forced currencies into every valid config.

export const SANDBOX_CONFIG = `
topology: sandbox
routing: path
auth:
  provider: demo
platform:
  authPublicUrl: http://localhost:3002
  frontendUrl: http://localhost:3000
oracle:
  url: http://localhost:3001
currencies:
  - code: USD
    label: US Dollar
    calendarId: USD
    isDefault: true
  - code: EUR
    label: Euro
    calendarId: EUR
csa:
  threshold:
    DirA: 0
    DirB: 0
  mta: 100000
  rounding: 10000
  valuationCcy: USD
  eligibleCollateral:
    - currency: USD
      haircut: 1.0
orgs:
  - id: goldman
    party: PartyA
    displayName: Goldman
    hint: PartyA
    role: trader
    ledgerUrl: http://localhost:7575
  - id: jpmorgan
    party: PartyB
    displayName: JPM
    hint: PartyB
    role: trader
    ledgerUrl: http://localhost:7575
  - id: operator
    party: Operator
    displayName: Operator
    hint: Operator
    role: operator
    ledgerUrl: http://localhost:7575
  - id: regulator
    party: Regulator
    displayName: Regulator
    hint: Regulator
    role: regulator
    ledgerUrl: http://localhost:7575
`

export const NETWORK_CONFIG = `
topology: network
routing: path
auth:
  provider: demo
platform:
  authPublicUrl: http://localhost:3002
  frontendUrl: http://localhost:3000
oracle:
  url: http://localhost:3001
currencies:
  - code: USD
    label: US Dollar
    calendarId: USD
    isDefault: true
  - code: EUR
    label: Euro
    calendarId: EUR
csa:
  threshold:
    DirA: 0
    DirB: 0
  mta: 100000
  rounding: 10000
  valuationCcy: USD
  eligibleCollateral:
    - currency: USD
      haircut: 1.0
orgs:
  - id: goldman
    party: PartyA
    displayName: Goldman
    hint: PartyA
    role: trader
    ledgerUrl: http://goldman:7575
  - id: jpmorgan
    party: PartyB
    displayName: JPM
    hint: PartyB
    role: trader
    ledgerUrl: http://jpmorgan:7575
  - id: operator
    party: Operator
    displayName: Operator
    hint: Operator
    role: operator
    ledgerUrl: http://operator:7575
  - id: regulator
    party: Regulator
    displayName: Regulator
    hint: Regulator
    role: regulator
    ledgerUrl: http://regulator:7575
`
