import { z } from "zod";

export const createUserSchema = z.object({
  email: z.email().max(320),
  displayName: z.string().trim().min(1).max(200),
  locale: z.string().trim().min(2).max(35).default("en"),
  externalSubject: z.string().trim().min(1).max(255).optional(),
});

export type CreateUserDto = z.input<typeof createUserSchema>;
