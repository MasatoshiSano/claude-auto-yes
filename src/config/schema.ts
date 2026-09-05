import { z } from "zod";

export const ConfigSchema = z.object({
  enabled: z.boolean(),
  claudePath: z.string().nullable(),
  enabledCwdPatterns: z.array(z.string()).nullable(),

  detect: z.object({
    questionPattern: z.string(),
    numberedOptionPattern: z.string(),
    affirmativePattern: z.string(),
    cursorChars: z.string(),
    borderChars: z.string(),
    requireCursor: z.boolean(),
    minOptions: z.number().int().min(2),
    maxLinesBetweenQuestionAndOptions: z.number().int().min(0),
    scanBottomLines: z.number().int().min(1),
    maxContextLines: z.number().int().min(0),
    maxCursorOnlyLabelLength: z.number().int().min(1),
  }),

  timing: z.object({
    quiesceMs: z.number().int().min(0),
    stabilityChecks: z.number().int().min(1),
    postSendCooldownMs: z.number().int().min(0),
    escalateAfterMs: z.number().int().min(0),
  }),

  response: z.object({
    escalationSteps: z.array(z.string()),
    maxEscalations: z.number().int().min(0),
  }),

  log: z.object({
    dir: z.string().nullable(),
    retainDays: z.number().int().min(1),
    includeContext: z.boolean(),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;
