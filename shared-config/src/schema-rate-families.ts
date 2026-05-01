import { z } from 'zod'

export const rateFamilyTenorSchema = z.object({
  id: z.string().min(1),
  days: z.number().int().positive(),
})

export const rateFamilySchema = z
  .object({
    curveIndexId: z.string().min(1),
    overnightIndexId: z.string().min(1),
    tenors: z.array(rateFamilyTenorSchema).min(1),
  })
  .superRefine((f, ctx) => {
    const seen = new Set<string>()
    f.tenors.forEach((t, i) => {
      if (seen.has(t.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tenors', i, 'id'],
          message: `duplicate tenor id: ${t.id}`,
        })
      }
      seen.add(t.id)
    })
  })

export const rateFamiliesSchema = z.record(z.string().min(1), rateFamilySchema)
export type RateFamilyTenor = z.infer<typeof rateFamilyTenorSchema>
export type RateFamily = z.infer<typeof rateFamilySchema>
export type RateFamiliesConfig = z.infer<typeof rateFamiliesSchema>
