import { z } from "zod";

export const ThresholdConfig = z.object({
  count: z.number().int().positive(),
});

export const VelocityConfig = z.object({
  count: z.number().int().positive(),
  window_seconds: z.number().int().positive().max(86_400),
});

export const FirstOfConfig = z.object({
  dimension: z.enum(["country", "device", "referrer"]),
});

const FilterArray = z.array(z.string().min(1)).min(1).max(50).optional();
export const PerClickConfig = z.object({
  filters: z
    .object({
      country: FilterArray,
      device: FilterArray,
      referrer: FilterArray,
    })
    .refine((f) => !!(f.country || f.device || f.referrer), {
      message: "per_click requires at least one filter dimension",
    }),
});

export const RuleBody = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("threshold"),
    config: ThresholdConfig,
    destination_url: z.string().url(),
    cooldown_seconds: z.number().int().nonnegative().max(86_400).default(0),
    enabled: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("velocity"),
    config: VelocityConfig,
    destination_url: z.string().url(),
    cooldown_seconds: z.number().int().nonnegative().max(86_400).default(60),
    enabled: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("first_of"),
    config: FirstOfConfig,
    destination_url: z.string().url(),
    cooldown_seconds: z.number().int().nonnegative().max(86_400).default(0),
    enabled: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("per_click"),
    config: PerClickConfig,
    destination_url: z.string().url(),
    cooldown_seconds: z.number().int().nonnegative().max(86_400).default(0),
    enabled: z.boolean().default(true),
  }),
]);

export type RuleBodyInput = z.infer<typeof RuleBody>;

export const RulePatchBody = z.object({
  destination_url: z.string().url().optional(),
  cooldown_seconds: z.number().int().nonnegative().max(86_400).optional(),
  enabled: z.boolean().optional(),
});
