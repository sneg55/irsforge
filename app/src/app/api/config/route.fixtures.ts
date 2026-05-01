// YAML fixtures for /api/config route tests. Extracted into a sibling so
// the test file stays under the 300-line cap.

// Full 4-org cluster — operator + regulator + 2 traders — required by the
// shared-config role-cardinality refinements.
export const ORGS_YAML_BLOCK = `
orgs:
  - id: a
    party: A
    displayName: A
    hint: A
    role: trader
    ledgerUrl: http://ledger:7575
  - id: b
    party: B
    displayName: B
    hint: B
    role: trader
    ledgerUrl: http://ledger:7575
  - id: operator
    party: Operator
    displayName: Operator
    hint: Operator
    role: operator
    ledgerUrl: http://ledger:7575
  - id: regulator
    party: Regulator
    displayName: Regulator
    hint: Regulator
    role: regulator
    ledgerUrl: http://ledger:7575
`
