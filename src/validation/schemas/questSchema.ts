import { z } from 'zod';

// ── Question / lesson input validation ────────────────────────────────────

const noNulls = (val: string) => !val.includes('\0');
const noHtml  = (val: string) => !/<[^>]*>/.test(val);

export const LessonInputSchema = z.object({
  text:   z.string().trim().min(10).max(50_000)
    .refine(noNulls, 'Null bytes not allowed'),
  apiKey: z.string().trim().min(10).max(200)
    .refine(noNulls, 'Null bytes not allowed')
    .optional(),
}).strict();

export const QuestionSchema = z.object({
  prompt:       z.string().trim().min(5).max(500).refine(noHtml, 'HTML not allowed'),
  answers:      z.array(z.string().trim().min(1).max(200).refine(noHtml, 'HTML not allowed')).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5),
  topic:        z.string().trim().max(100),
}).strict();

export const QuestionBankSchema = z.array(QuestionSchema).min(1).max(200);

export type LessonInput = z.infer<typeof LessonInputSchema>;
export type Question    = z.infer<typeof QuestionSchema>;
