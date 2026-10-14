import { z } from 'zod';

export const issueCardSchema = z.object({
  customer: z.object({
    documentType: z.literal('DNI'),
    documentNumber: z.string().regex(/^\d{8}$/),
    fullName: z.string().min(5),
    age: z.number().min(18),
    email: z.string().email()
  }),

  product: z.object({
    type: z.literal('VISA'),
    currency: z.enum(['PEN', 'USD'])
  }),

  forceError: z.boolean().optional()
});

export type IssueCardDto = z.infer<typeof issueCardSchema>;
