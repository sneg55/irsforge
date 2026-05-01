export const PARTY_CONFIGS = [
  {
    id: 'PARTY_A' as const,
    label: 'Goldman Sachs',
    role: 'Fixed-Rate Payer',
    description: 'Propose and manage IRS positions',
  },
  {
    id: 'PARTY_B' as const,
    label: 'JPMorgan',
    role: 'Float-Rate Payer',
    description: 'Accept proposals and trade',
  },
  {
    id: 'OPERATOR' as const,
    label: 'Operator',
    role: 'Platform Admin',
    description: 'Publish rates and manage lifecycle',
  },
  {
    id: 'REGULATOR' as const,
    label: 'Regulator',
    role: 'Observer',
    description: 'View swap terms and settlements',
  },
]

export type PartyConfigId = (typeof PARTY_CONFIGS)[number]['id']
