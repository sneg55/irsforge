import {
  ASSET_ACCEPT_ACK_TEMPLATE_ID,
  BASIS_ACCEPT_ACK_TEMPLATE_ID,
  CCY_ACCEPT_ACK_TEMPLATE_ID,
  CDS_ACCEPT_ACK_TEMPLATE_ID,
  FPML_ACCEPT_ACK_TEMPLATE_ID,
  FX_ACCEPT_ACK_TEMPLATE_ID,
  IRS_ACCEPT_ACK_TEMPLATE_ID,
  OIS_ACCEPT_ACK_TEMPLATE_ID,
  XCCY_ACCEPT_ACK_TEMPLATE_ID,
} from './template-ids'

// Single source of truth for the operator's AcceptAck flow: one map keyed
// by swap family, each row carrying the AcceptAck template id + the
// family's ConfirmAccept choice name (Daml casing, e.g. `FpmlConfirmAccept`
// not `FpMLConfirmAccept`).
//
// Adding a new family means: new template-id constant + one entry here.
// Everything downstream — queue queries, co-sign dispatch, type unions —
// derives from this object.

export type SwapFamily = 'IRS' | 'OIS' | 'BASIS' | 'XCCY' | 'CDS' | 'CCY' | 'FX' | 'ASSET' | 'FpML'

export interface OperatorAcceptAckEntry {
  readonly family: SwapFamily
  readonly templateId: string
  readonly confirmChoice: string
}

export const OPERATOR_ACCEPT_ACK: Record<SwapFamily, OperatorAcceptAckEntry> = {
  IRS: { family: 'IRS', templateId: IRS_ACCEPT_ACK_TEMPLATE_ID, confirmChoice: 'IrsConfirmAccept' },
  OIS: { family: 'OIS', templateId: OIS_ACCEPT_ACK_TEMPLATE_ID, confirmChoice: 'OisConfirmAccept' },
  BASIS: {
    family: 'BASIS',
    templateId: BASIS_ACCEPT_ACK_TEMPLATE_ID,
    confirmChoice: 'BasisConfirmAccept',
  },
  XCCY: {
    family: 'XCCY',
    templateId: XCCY_ACCEPT_ACK_TEMPLATE_ID,
    confirmChoice: 'XccyConfirmAccept',
  },
  CDS: { family: 'CDS', templateId: CDS_ACCEPT_ACK_TEMPLATE_ID, confirmChoice: 'CdsConfirmAccept' },
  CCY: { family: 'CCY', templateId: CCY_ACCEPT_ACK_TEMPLATE_ID, confirmChoice: 'CcyConfirmAccept' },
  FX: { family: 'FX', templateId: FX_ACCEPT_ACK_TEMPLATE_ID, confirmChoice: 'FxConfirmAccept' },
  ASSET: {
    family: 'ASSET',
    templateId: ASSET_ACCEPT_ACK_TEMPLATE_ID,
    confirmChoice: 'AssetConfirmAccept',
  },
  FpML: {
    family: 'FpML',
    templateId: FPML_ACCEPT_ACK_TEMPLATE_ID,
    confirmChoice: 'FpmlConfirmAccept',
  },
}

export const SWAP_FAMILIES: readonly SwapFamily[] = Object.keys(OPERATOR_ACCEPT_ACK) as SwapFamily[]

export const OPERATOR_ACCEPT_ACK_ENTRIES: readonly OperatorAcceptAckEntry[] =
  Object.values(OPERATOR_ACCEPT_ACK)
