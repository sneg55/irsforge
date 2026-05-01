import type React from 'react'
import { WORKSPACE_COLORS } from '../constants'
import type { CurrencyOption } from '../hooks/use-currency-options'
import type { LegConfig } from '../types'
import { formatFixedRate, formatNotional, formatSpread } from '../utils/format'
import type { FieldDef } from './field-grid'

const TOOLTIP_NOTIONAL = 'Trade notional amount'

const DAY_COUNT_OPTIONS = [
  { label: 'ACT/360', value: 'ACT_360' },
  { label: 'ACT/365', value: 'ACT_365' },
  { label: '30/360', value: 'THIRTY_360' },
  { label: '30E/360', value: 'THIRTY_E_360' },
]

const FREQUENCY_OPTIONS = [
  { label: 'Monthly', value: 'Monthly' },
  { label: 'Quarterly', value: 'Quarterly' },
  { label: 'Semi-Annual', value: 'SemiAnnual' },
  { label: 'Annual', value: 'Annual' },
]

export function buildFields(
  leg: LegConfig,
  editable: boolean,
  onChange: (field: string, value: string) => void,
  currencyOptions: CurrencyOption[],
  indexOptions: { label: string; value: string }[],
  notionalLabelSuffix?: React.ReactNode,
): FieldDef[] {
  const fields: FieldDef[] = []
  const e = editable

  if (leg.legType === 'fixed') {
    fields.push(
      {
        label: 'Currency',
        value: leg.currency,
        editable: e,
        type: 'select',
        options: currencyOptions,
        onChange: (v) => onChange('currency', v),
      },
      {
        label: 'Notional',
        labelSuffix: notionalLabelSuffix,
        value: formatNotional(leg.notional),
        editable: e,
        type: 'number',
        step: 100000,
        onChange: (v) => onChange('notional', v),
        tooltip: TOOLTIP_NOTIONAL,
      },
      {
        label: 'Fixed Rate',
        value: formatFixedRate(leg.rate),
        editable: e,
        type: 'number',
        step: 0.0001,
        unit: '%',
        onChange: (v) => onChange('rate', String(parseFloat(v) / 100)),
        color: WORKSPACE_COLORS.green,
        tooltip: 'Fixed coupon rate',
      },
      {
        label: 'Day Count',
        value: leg.dayCount.replace(/_/g, '/'),
        editable: e,
        type: 'select',
        options: DAY_COUNT_OPTIONS,
        onChange: (v) => onChange('dayCount', v),
        tooltip: 'Day count convention',
      },
      {
        label: 'Frequency',
        value: leg.schedule.frequency,
        editable: e,
        type: 'select',
        options: FREQUENCY_OPTIONS,
        onChange: (v) => onChange('frequency', v),
        tooltip: 'Payment frequency',
      },
    )
  } else if (leg.legType === 'float') {
    fields.push(
      {
        label: 'Currency',
        value: leg.currency,
        editable: e,
        type: 'select',
        options: currencyOptions,
        onChange: (v) => onChange('currency', v),
      },
      {
        label: 'Notional',
        labelSuffix: notionalLabelSuffix,
        value: formatNotional(leg.notional),
        editable: e,
        type: 'number',
        step: 100000,
        onChange: (v) => onChange('notional', v),
        tooltip: TOOLTIP_NOTIONAL,
      },
      {
        label: 'Index',
        value: leg.indexId,
        editable: e,
        type: 'select',
        options:
          indexOptions.length > 0 || !leg.indexId
            ? indexOptions
            : [{ label: leg.indexId, value: leg.indexId }, ...indexOptions],
        onChange: (v) => onChange('indexId', v),
        color: WORKSPACE_COLORS.red,
        tooltip: 'Floating rate index',
      },
      {
        label: 'Spread',
        value: formatSpread(leg.spread),
        editable: e,
        type: 'number',
        step: 0.0001,
        unit: 'bp',
        onChange: (v) => onChange('spread', String(parseFloat(v) / 10000)),
        tooltip: 'Spread over index in basis points',
      },
      {
        label: 'Day Count',
        value: leg.dayCount.replace(/_/g, '/'),
        editable: e,
        type: 'select',
        options: DAY_COUNT_OPTIONS,
        onChange: (v) => onChange('dayCount', v),
        tooltip: 'Day count convention',
      },
      {
        label: 'Frequency',
        value: leg.schedule.frequency,
        editable: e,
        type: 'select',
        options: FREQUENCY_OPTIONS,
        onChange: (v) => onChange('frequency', v),
        tooltip: 'Payment frequency',
      },
    )
  } else if (leg.legType === 'protection') {
    fields.push(
      {
        label: 'Currency',
        value: 'USD',
        editable: false,
        tooltip: 'Denomination of the protection payment',
      },
      {
        label: 'Notional',
        labelSuffix: notionalLabelSuffix,
        value: formatNotional(leg.notional),
        editable: e,
        type: 'number',
        step: 100000,
        onChange: (v) => onChange('notional', v),
        tooltip: TOOLTIP_NOTIONAL,
      },
      {
        label: 'Recovery Rate',
        value: `${(leg.recoveryRate * 100).toFixed(1)}%`,
        editable: e,
        type: 'number',
        step: 1,
        unit: '%',
        onChange: (v) => onChange('recoveryRate', String(parseFloat(v) / 100)),
        tooltip: 'Expected recovery rate',
      },
      { label: 'Reference', value: 'DEFAULT', editable: false, tooltip: 'Reference credit entity' },
      { label: 'Seniority', value: 'SNR UNSEC', editable: false, tooltip: 'Debt seniority tier' },
      {
        label: 'Restructuring',
        value: 'XR14',
        editable: false,
        tooltip: 'ISDA restructuring clause',
      },
    )
  } else if (leg.legType === 'asset') {
    fields.push({
      label: 'Notional',
      labelSuffix: notionalLabelSuffix,
      value: formatNotional(leg.notional),
      editable: e,
      type: 'number',
      step: 100000,
      onChange: (v) => onChange('notional', v),
      tooltip: TOOLTIP_NOTIONAL,
    })
  } else if (leg.legType === 'fx') {
    fields.push(
      {
        label: 'Base CCY',
        value: leg.baseCurrency,
        editable: e,
        type: 'select',
        options: currencyOptions,
        onChange: (v) => onChange('baseCurrency', v),
      },
      {
        label: 'Foreign CCY',
        value: leg.foreignCurrency,
        editable: e,
        type: 'select',
        options: currencyOptions,
        onChange: (v) => onChange('foreignCurrency', v),
      },
      {
        label: 'Notional',
        labelSuffix: notionalLabelSuffix,
        value: formatNotional(leg.notional),
        editable: e,
        type: 'number',
        step: 100000,
        onChange: (v) => onChange('notional', v),
        tooltip: TOOLTIP_NOTIONAL,
      },
      {
        label: 'FX Rate',
        value: Number(leg.fxRate).toFixed(4),
        editable: e,
        type: 'number',
        step: 0.0001,
        onChange: (v) => onChange('fxRate', v),
        tooltip: 'FX spot rate',
      },
    )
  }

  return fields
}
