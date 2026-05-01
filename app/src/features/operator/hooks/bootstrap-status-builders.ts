// Pure builders that derive the bootstrap-status section list from raw
// query results. Hook uses these — separated so the hook stays slim.

import type {
  BootstrapRow,
  BootstrapSection,
  CalendarPayload,
  LifecycleRulePayload,
  UseBootstrapStatusResult,
} from './bootstrap-status-types'

interface QuerySnapshot {
  data: Array<{ contractId: string; payload: unknown }> | undefined
  isLoading: boolean
}

interface RowSpec {
  key: string
  section: BootstrapSection
  label: string
  count: number
  loading: boolean
  ledgerTemplateFilter: string
  contractId: string | null
  minExpected?: number
}

export function row(spec: RowSpec): BootstrapRow {
  const minExpected = spec.minExpected ?? 1
  return {
    key: spec.key,
    section: spec.section,
    label: spec.label,
    count: spec.count,
    minExpected,
    ok: spec.count >= minExpected,
    loading: spec.loading,
    ledgerTemplateFilter: spec.ledgerTemplateFilter,
    contractId: spec.contractId,
  }
}

function firstCid(snap: QuerySnapshot): string | null {
  return snap.data?.[0]?.contractId ?? null
}

function calendarRows(snap: QuerySnapshot): BootstrapRow[] {
  const data = (snap.data ?? []) as Array<{ contractId: string; payload: CalendarPayload }>
  if (snap.isLoading && data.length === 0) {
    return [
      row({
        key: 'calendar-loading',
        section: 'Calendars',
        label: 'Holiday calendars',
        count: 0,
        loading: true,
        ledgerTemplateFilter: 'Reference.HolidayCalendar',
        contractId: null,
      }),
    ]
  }
  if (data.length === 0) {
    return [
      row({
        key: 'calendar-missing',
        section: 'Calendars',
        label: 'Holiday calendars',
        count: 0,
        loading: false,
        ledgerTemplateFilter: 'Reference.HolidayCalendar',
        contractId: null,
      }),
    ]
  }
  return data.map((c) =>
    row({
      key: `calendar-${c.payload.calendar.id}`,
      section: 'Calendars',
      label: `Holiday calendar — ${c.payload.calendar.id}`,
      count: 1,
      loading: snap.isLoading,
      ledgerTemplateFilter: 'Reference.HolidayCalendar',
      contractId: c.contractId,
    }),
  )
}

function lifecycleRows(snap: QuerySnapshot): BootstrapRow[] {
  const data = (snap.data ?? []) as Array<{ contractId: string; payload: LifecycleRulePayload }>
  const manual = data.filter((r) => r.payload.id.unpack === 'lifecycle-rule-001')
  const scheduler = data.filter((r) => r.payload.id.unpack === 'lifecycle-rule-scheduler')
  return [
    row({
      key: 'lifecycle-manual',
      section: 'Lifecycle',
      label: 'Lifecycle rule — manual',
      count: manual.length,
      loading: snap.isLoading,
      ledgerTemplateFilter: 'Lifecycle.Rule',
      contractId: manual[0]?.contractId ?? null,
    }),
    row({
      key: 'lifecycle-scheduler',
      section: 'Lifecycle',
      label: 'Lifecycle rule — scheduler',
      count: scheduler.length,
      loading: snap.isLoading,
      ledgerTemplateFilter: 'Lifecycle.Rule',
      contractId: scheduler[0]?.contractId ?? null,
    }),
  ]
}

interface BuildInput {
  roleSetup: QuerySnapshot
  schedulerRole: QuerySnapshot
  holidayCalendar: QuerySnapshot
  lifecycleRule: QuerySnapshot
  eventFactory: QuerySnapshot
  irsFactory: QuerySnapshot
  cdsFactory: QuerySnapshot
  ccyFactory: QuerySnapshot
  fxFactory: QuerySnapshot
  assetFactory: QuerySnapshot
  fpmlFactory: QuerySnapshot
  cashSetup: QuerySnapshot
  demoProvider: QuerySnapshot
  nyfedProvider: QuerySnapshot
}

const FACTORY_ROW_DEFS: ReadonlyArray<readonly [keyof BuildInput, string, string, string]> = [
  ['eventFactory', 'event-factory', 'Event factory', 'Setup.EventFactory'],
  ['irsFactory', 'irs-factory', 'IRS factory', 'InterestRate.Factory'],
  ['cdsFactory', 'cds-factory', 'CDS factory', 'CreditDefault.Factory'],
  ['ccyFactory', 'ccy-factory', 'Currency factory', 'Currency.Factory'],
  ['fxFactory', 'fx-factory', 'FX factory', 'ForeignExchange.Factory'],
  ['assetFactory', 'asset-factory', 'Asset factory', 'Asset.Factory'],
  ['fpmlFactory', 'fpml-factory', 'FpML factory', 'Fpml.Factory'],
] as const

function factoryRows(input: BuildInput): BootstrapRow[] {
  return FACTORY_ROW_DEFS.map(([snapKey, key, label, filter]) =>
    row({
      key,
      section: 'Factories',
      label,
      count: input[snapKey].data?.length ?? 0,
      loading: input[snapKey].isLoading,
      ledgerTemplateFilter: filter,
      contractId: firstCid(input[snapKey]),
    }),
  )
}

export function buildBootstrapResult(input: BuildInput): UseBootstrapStatusResult {
  const oracleCount =
    (input.demoProvider.data?.length ?? 0) + (input.nyfedProvider.data?.length ?? 0)
  const oracleLoading = input.demoProvider.isLoading || input.nyfedProvider.isLoading
  const oracleCid = firstCid(input.demoProvider) ?? firstCid(input.nyfedProvider)

  const sections: { name: BootstrapSection; rows: BootstrapRow[] }[] = [
    {
      name: 'Identity',
      rows: [
        row({
          key: 'role-setup',
          section: 'Identity',
          label: 'Role setup',
          count: input.roleSetup.data?.length ?? 0,
          loading: input.roleSetup.isLoading,
          ledgerTemplateFilter: 'Setup.RoleSetup',
          contractId: firstCid(input.roleSetup),
        }),
        row({
          key: 'scheduler-role',
          section: 'Identity',
          label: 'Scheduler role',
          count: input.schedulerRole.data?.length ?? 0,
          loading: input.schedulerRole.isLoading,
          ledgerTemplateFilter: 'Setup.SchedulerRole',
          contractId: firstCid(input.schedulerRole),
        }),
      ],
    },
    { name: 'Calendars', rows: calendarRows(input.holidayCalendar) },
    { name: 'Lifecycle', rows: lifecycleRows(input.lifecycleRule) },
    { name: 'Factories', rows: factoryRows(input) },
    {
      name: 'Cash & oracle',
      rows: [
        row({
          key: 'cash-setup',
          section: 'Cash & oracle',
          label: 'Cash setup record',
          count: input.cashSetup.data?.length ?? 0,
          loading: input.cashSetup.isLoading,
          ledgerTemplateFilter: 'Setup.CashSetup',
          contractId: firstCid(input.cashSetup),
        }),
        row({
          key: 'oracle-provider',
          section: 'Cash & oracle',
          label: 'Oracle provider',
          count: oracleCount,
          loading: oracleLoading,
          ledgerTemplateFilter: 'Oracle.',
          contractId: oracleCid,
        }),
      ],
    },
  ]

  const allRows = sections.flatMap((s) => s.rows)
  return {
    sections,
    totalRows: allRows.length,
    totalOk: allRows.filter((r) => r.ok).length,
    allOk: allRows.every((r) => r.ok),
    anyLoading: allRows.some((r) => r.loading),
  }
}
