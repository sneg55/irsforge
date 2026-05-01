// Bootstrap query keys + their corresponding Daml template ids. Kept
// flat so adding a new bootstrap-tracked template is a one-line edit.

import {
  ASSET_FACTORY_TEMPLATE_ID,
  CASH_SETUP_RECORD_TEMPLATE_ID,
  CCY_FACTORY_TEMPLATE_ID,
  CDS_FACTORY_TEMPLATE_ID,
  DEMO_STUB_PROVIDER_TEMPLATE_ID,
  EVENT_FACTORY_TEMPLATE_ID,
  FPML_FACTORY_TEMPLATE_ID,
  FX_FACTORY_TEMPLATE_ID,
  HOLIDAY_CALENDAR_TEMPLATE_ID,
  IRS_FACTORY_TEMPLATE_ID,
  LIFECYCLE_RULE_TEMPLATE_ID,
  NYFED_PROVIDER_TEMPLATE_ID,
  ROLE_SETUP_TEMPLATE_ID,
  SCHEDULER_ROLE_TEMPLATE_ID,
} from '@/shared/ledger/template-ids'

export const BOOTSTRAP_QUERY_KEYS = [
  'role-setup',
  'scheduler-role',
  'holiday-calendar',
  'lifecycle-rule',
  'event-factory',
  'irs-factory',
  'cds-factory',
  'ccy-factory',
  'fx-factory',
  'asset-factory',
  'fpml-factory',
  'cash-setup',
  'demo-provider',
  'nyfed-provider',
] as const

export type BootstrapQueryKey = (typeof BOOTSTRAP_QUERY_KEYS)[number]

export const BOOTSTRAP_TEMPLATE_BY_KEY: Record<BootstrapQueryKey, string> = {
  'role-setup': ROLE_SETUP_TEMPLATE_ID,
  'scheduler-role': SCHEDULER_ROLE_TEMPLATE_ID,
  'holiday-calendar': HOLIDAY_CALENDAR_TEMPLATE_ID,
  'lifecycle-rule': LIFECYCLE_RULE_TEMPLATE_ID,
  'event-factory': EVENT_FACTORY_TEMPLATE_ID,
  'irs-factory': IRS_FACTORY_TEMPLATE_ID,
  'cds-factory': CDS_FACTORY_TEMPLATE_ID,
  'ccy-factory': CCY_FACTORY_TEMPLATE_ID,
  'fx-factory': FX_FACTORY_TEMPLATE_ID,
  'asset-factory': ASSET_FACTORY_TEMPLATE_ID,
  'fpml-factory': FPML_FACTORY_TEMPLATE_ID,
  'cash-setup': CASH_SETUP_RECORD_TEMPLATE_ID,
  'demo-provider': DEMO_STUB_PROVIDER_TEMPLATE_ID,
  'nyfed-provider': NYFED_PROVIDER_TEMPLATE_ID,
}
