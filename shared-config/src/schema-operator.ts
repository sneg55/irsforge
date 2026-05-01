import { z } from 'zod'

export const operatorPolicyModeSchema = z.enum(['auto', 'manual'])

export const operatorSchema = z
  .object({
    policy: z
      .object({
        IRS: operatorPolicyModeSchema.default('auto'),
        OIS: operatorPolicyModeSchema.default('auto'),
        BASIS: operatorPolicyModeSchema.default('auto'),
        XCCY: operatorPolicyModeSchema.default('auto'),
        CDS: operatorPolicyModeSchema.default('auto'),
        CCY: operatorPolicyModeSchema.default('auto'),
        FX: operatorPolicyModeSchema.default('auto'),
        ASSET: operatorPolicyModeSchema.default('auto'),
        FpML: operatorPolicyModeSchema.default('auto'),
      })
      .default({}),
  })
  .default({})
