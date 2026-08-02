import { z } from "zod";

const gameTypes = ["SPIN_WHEEL", "SCRATCH_CARD", "MYSTERY_BOX"] as const;
const gameStatuses = ["DRAFT", "ACTIVE", "SUSPENDED", "ARCHIVED"] as const;
const prizeTypes = ["POINTS", "REWARD", "DISCOUNT", "TRY_AGAIN"] as const;

export const gameCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .transform((value) => value.toUpperCase());

export const playGameSchema = z.object({
  idempotencyKey: z
    .string()
    .trim()
    .min(12)
    .max(160)
    .regex(/^[A-Za-z0-9:._-]+$/),
});

export const createGameSchema = z.object({
  organizationId: z.uuid(),
  programId: z.uuid(),
  code: gameCodeSchema,
  type: z.enum(gameTypes),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).optional(),
  cooldownMinutes: z.coerce.number().int().min(0).max(43_200).default(1_440),
  dailyLimit: z.coerce.number().int().min(1).max(100).default(1),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  settings: z.record(z.string(), z.unknown()).default({}),
});

export const updateGameSchema = createGameSchema
  .omit({ organizationId: true, programId: true, code: true, type: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const gameStatusSchema = z.object({ status: z.enum(gameStatuses) });

export const gamePrizeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .transform((value) => value.toUpperCase()),
    label: z.string().trim().min(2).max(160),
    type: z.enum(prizeTypes),
    points: z.coerce.number().int().min(0).max(1_000_000).default(0),
    rewardId: z.uuid().optional(),
    discountPercent: z.coerce.number().int().min(1).max(100).optional(),
    probabilityWeight: z.coerce.number().int().min(1).max(100_000),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9a-f]{6}$/i)
      .default("#2563eb"),
    active: z.boolean().default(true),
    stockQuantity: z.coerce.number().int().min(0).optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((value, context) => {
    if ((value.type === "REWARD" || value.type === "DISCOUNT") && !value.rewardId) {
      context.addIssue({
        code: "custom",
        message: "rewardId is required for reward and discount prizes",
      });
    }
    if (value.type === "POINTS" && value.points <= 0) {
      context.addIssue({ code: "custom", message: "points must be positive for a points prize" });
    }
  });

export const replaceGamePrizesSchema = z.object({
  prizes: z.array(gamePrizeSchema).min(2).max(50),
});

export type CreateGameDto = z.output<typeof createGameSchema>;
export type UpdateGameDto = z.output<typeof updateGameSchema>;
export type GameStatusDto = z.output<typeof gameStatusSchema>;
export type ReplaceGamePrizesDto = z.output<typeof replaceGamePrizesSchema>;
