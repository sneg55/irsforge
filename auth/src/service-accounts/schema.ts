import { z } from 'zod'

export const serviceAccountEntrySchema = z.object({
  id: z.string().min(1),
  clientSecretHash: z.string().min(1),
})

export const serviceAccountsFileSchema = z.object({
  accounts: z.array(serviceAccountEntrySchema).default([]),
})

export type ServiceAccountEntry = z.infer<typeof serviceAccountEntrySchema>
