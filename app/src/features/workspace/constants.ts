import type { StatusAction, SwapStatus, SwapType, SwapTypeConfig } from './types'

const defaultSchedule = {
  startDate: new Date(),
  endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
  frequency: 'Quarterly' as const,
}

const annualSchedule = {
  startDate: new Date(),
  endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
  frequency: 'Annual' as const,
}

const semiAnnualSchedule = {
  startDate: new Date(),
  endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
  frequency: 'SemiAnnual' as const,
}

export const SWAP_TYPE_CONFIGS: Record<SwapType, SwapTypeConfig> = {
  IRS: {
    label: 'Interest Rate Swap',
    shortLabel: 'IRS',
    defaultLegs: [
      {
        legType: 'fixed',
        direction: 'receive' as const,
        currency: 'USD',
        notional: 50_000_000,
        rate: 0.0425,
        dayCount: 'ACT_360',
        schedule: { ...defaultSchedule },
      },
      // indexId is the FloatingRateIndex registry key (Phase 3 Stage A) —
      // `useFloatingRateIndex(indexId)` looks up the on-chain contract and
      // feeds metadata (family/compounding/lookback/floor) into the Stage B
      // compounded-in-arrears pricer. The SAME id is written to the
      // instrument's FloatingRate.referenceRateId at Accept time, so the
      // Daml Finance lifecycle reads the matching Observation series.
      // Default 'USD-SOFR' matches the YAML-seeded FloatingRateIndex.
      {
        legType: 'float',
        direction: 'pay' as const,
        currency: 'USD',
        notional: 50_000_000,
        indexId: 'USD-SOFR',
        spread: 0.0025,
        dayCount: 'ACT_360',
        schedule: { ...defaultSchedule },
      },
    ],
    directionField: 'ownerReceivesFix',
    curveType: 'sofr',
    valuationMetrics: ['NPV', 'Par Rate', 'DV01', 'Mod Duration'],
  },
  OIS: {
    label: 'Overnight Index Swap',
    shortLabel: 'OIS',
    defaultLegs: [
      // OIS = fixed vs overnight-compounded float, annual payment frequency
      // by default. Reuses the IRS pricing strategy; the only divergence is
      // the annual schedule which flows through scheduleDefaults["OIS"]
      // (12M) on the Daml side.
      {
        legType: 'fixed',
        direction: 'receive' as const,
        currency: 'USD',
        notional: 50_000_000,
        rate: 0.04,
        dayCount: 'ACT_360',
        schedule: { ...annualSchedule },
      },
      {
        legType: 'float',
        direction: 'pay' as const,
        currency: 'USD',
        notional: 50_000_000,
        indexId: 'USD-SOFR',
        spread: 0.0,
        dayCount: 'ACT_360',
        schedule: { ...annualSchedule },
      },
    ],
    directionField: 'ownerReceivesFix',
    curveType: 'sofr',
    valuationMetrics: ['NPV', 'Par Rate', 'DV01', 'Mod Duration'],
  },
  BASIS: {
    // Stage D — two float legs, single currency, two different
    // FloatingRateIndex contracts. Each leg's index lives in
    // irsforge.yaml.floatingRateIndices and is seeded by the oracle at
    // startup. BasisAccept resolves both contracts by indexId at accept
    // time.
    label: 'Basis Swap',
    shortLabel: 'BASIS',
    defaultLegs: [
      {
        legType: 'float',
        direction: 'pay' as const,
        currency: 'USD',
        notional: 50_000_000,
        indexId: 'USD-SOFR',
        spread: 0.0,
        dayCount: 'ACT_360',
        schedule: { ...defaultSchedule },
      },
      {
        legType: 'float',
        direction: 'receive' as const,
        currency: 'USD',
        notional: 50_000_000,
        indexId: 'USD-EFFR',
        spread: 0.0025,
        dayCount: 'ACT_360',
        schedule: { ...defaultSchedule },
      },
    ],
    directionField: 'implied',
    curveType: 'sofr',
    valuationMetrics: ['NPV', 'Basis', 'DV01'],
  },
  XCCY: {
    // Stage E placeholder — fixed + float across currencies. UI hides the
    // product until observables.XCCY.enabled flips to true.
    label: 'Cross-Currency Swap',
    shortLabel: 'XCCY',
    defaultLegs: [
      {
        legType: 'fixed',
        direction: 'receive' as const,
        currency: 'USD',
        notional: 50_000_000,
        rate: 0.04,
        dayCount: 'ACT_360',
        schedule: { ...semiAnnualSchedule },
      },
      {
        legType: 'float',
        direction: 'pay' as const,
        currency: 'EUR',
        notional: 45_000_000,
        indexId: 'EUR-ESTR',
        spread: 0.0,
        dayCount: 'ACT_360',
        schedule: { ...semiAnnualSchedule },
      },
    ],
    directionField: 'ownerReceivesFix',
    curveType: 'dual',
    valuationMetrics: ['NPV', 'FX Rate', 'DV01', 'Cross-CCY Basis'],
  },
  CDS: {
    label: 'Credit Default Swap',
    shortLabel: 'CDS',
    defaultLegs: [
      {
        legType: 'fixed',
        direction: 'pay' as const,
        currency: 'USD',
        notional: 10_000_000,
        rate: 0.01,
        dayCount: 'ACT_360',
        schedule: { ...defaultSchedule },
      },
      {
        legType: 'protection',
        direction: 'receive' as const,
        notional: 10_000_000,
        recoveryRate: 0.4,
      },
    ],
    directionField: 'ownerReceivesFix',
    curveType: 'hazard',
    valuationMetrics: ['NPV', 'Spread', 'DV01', 'Default Prob'],
  },
  CCY: {
    label: 'Currency Swap',
    shortLabel: 'CCY',
    defaultLegs: [
      {
        legType: 'fixed',
        direction: 'pay' as const,
        currency: 'USD',
        notional: 50_000_000,
        rate: 0.04,
        dayCount: 'ACT_360',
        schedule: { ...defaultSchedule },
      },
      {
        legType: 'fixed',
        direction: 'receive' as const,
        currency: 'EUR',
        notional: 45_000_000,
        rate: 0.035,
        dayCount: 'ACT_360',
        schedule: { ...defaultSchedule },
      },
    ],
    directionField: 'ownerReceivesBase',
    curveType: 'dual',
    valuationMetrics: ['NPV', 'FX Rate', 'DV01', 'Cross-CCY Basis'],
  },
  FX: {
    label: 'FX Swap',
    shortLabel: 'FX',
    defaultLegs: [
      {
        legType: 'fx',
        direction: 'pay' as const,
        baseCurrency: 'USD',
        foreignCurrency: 'EUR',
        notional: 10_000_000,
        fxRate: 1.08,
        paymentDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
      },
      {
        legType: 'fx',
        direction: 'receive' as const,
        baseCurrency: 'USD',
        foreignCurrency: 'EUR',
        notional: 10_000_000,
        fxRate: 1.085,
        paymentDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      },
    ],
    directionField: 'implied',
    curveType: 'fx-forward',
    valuationMetrics: ['NPV', 'Forward Points', 'DV01'],
  },
  ASSET: {
    label: 'Asset Swap',
    shortLabel: 'ASSET',
    defaultLegs: [
      {
        legType: 'asset',
        direction: 'receive' as const,
        notional: 10_000_000,
        underlyings: [{ assetId: 'UST-10Y', weight: 1.0, initialPrice: 100, currentPrice: 100 }],
      },
      {
        legType: 'float',
        direction: 'pay' as const,
        currency: 'USD',
        notional: 10_000_000,
        indexId: 'USD-SOFR',
        spread: 0.005,
        dayCount: 'ACT_360',
        schedule: { ...defaultSchedule },
      },
    ],
    directionField: 'ownerReceivesRate',
    curveType: 'asset',
    valuationMetrics: ['NPV', 'Asset Return', 'DV01', 'Spread'],
  },
  FpML: {
    label: 'FpML Generic',
    shortLabel: 'FpML',
    defaultLegs: [], // starts empty — user adds legs
    directionField: 'custom',
    curveType: 'sofr',
    valuationMetrics: ['NPV', 'DV01'],
  },
}

export const WORKSPACE_COLORS = {
  amber: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  gray: '#555b6e',
  bgMain: '#0c0e14',
  bgPanel: '#111320',
  border: '#1e2235',
} as const

export const STATUS_COLORS: Record<string, string> = {
  Proposed: 'text-yellow-400',
  Active: 'text-green-400',
  PendingSettlement: 'text-blue-400',
  Matured: 'text-zinc-400',
  Terminated: 'text-red-400',
}

/** Maps generic action → actual Daml choice name per swap type */
export const PROPOSAL_CHOICES: Record<
  SwapType,
  { accept: string; reject: string; withdraw: string }
> = {
  IRS: { accept: 'Accept', reject: 'Reject', withdraw: 'Withdraw' },
  OIS: { accept: 'OisAccept', reject: 'OisReject', withdraw: 'OisWithdraw' },
  BASIS: { accept: 'BasisAccept', reject: 'BasisReject', withdraw: 'BasisWithdraw' },
  XCCY: { accept: 'XccyAccept', reject: 'XccyReject', withdraw: 'XccyWithdraw' },
  CDS: { accept: 'CdsAccept', reject: 'CdsReject', withdraw: 'CdsWithdraw' },
  CCY: { accept: 'CcyAccept', reject: 'CcyReject', withdraw: 'CcyWithdraw' },
  FX: { accept: 'FxAccept', reject: 'FxReject', withdraw: 'FxWithdraw' },
  ASSET: { accept: 'AssetAccept', reject: 'AssetReject', withdraw: 'AssetWithdraw' },
  FpML: { accept: 'FpmlAccept', reject: 'FpmlReject', withdraw: 'FpmlWithdraw' },
}

export const STATUS_ACTIONS: Record<string, StatusAction[]> = {
  Proposed_counterparty: [
    { target: 'proposal', choice: 'accept', label: 'Accept', variant: 'primary' },
    { target: 'proposal', choice: 'reject', label: 'Reject', variant: 'ghost' },
  ],
  Proposed_proposer: [
    { target: 'proposal', choice: 'withdraw', label: 'Withdraw', variant: 'ghost' },
  ],
  Active: [
    {
      target: 'workflow',
      choice: 'TriggerLifecycle',
      label: 'TRIGGER FIXING',
      variant: 'primary',
      operatorOnly: true,
    },
    {
      target: 'workflow',
      choice: 'Settle',
      label: 'Settle',
      variant: 'primary',
      operatorOnly: true,
    },
    {
      target: 'workflow',
      choice: 'Mature',
      label: 'Mature',
      variant: 'primary',
      operatorOnly: true,
    },
    { target: 'terminateProposal', choice: 'propose', label: 'Unwind', variant: 'ghost' },
  ],
  PendingSettlement: [
    {
      target: 'workflow',
      choice: 'Settle',
      label: 'Settle',
      variant: 'primary',
      operatorOnly: true,
    },
  ],
  PendingUnwind_counterparty: [
    { target: 'terminateProposal', choice: 'TpAccept', label: 'Accept Unwind', variant: 'primary' },
    { target: 'terminateProposal', choice: 'TpReject', label: 'Reject Unwind', variant: 'ghost' },
  ],
  PendingUnwind_proposer: [
    {
      target: 'terminateProposal',
      choice: 'TpWithdraw',
      label: 'Withdraw Unwind',
      variant: 'ghost',
    },
  ],
  Matured: [],
  Terminated: [],
}

export const ALL_SWAP_TYPES: SwapType[] = [
  'IRS',
  'OIS',
  'BASIS',
  'XCCY',
  'CDS',
  'CCY',
  'FX',
  'ASSET',
  'FpML',
]
