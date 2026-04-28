import { z } from "zod";

const squareSchema = z
  .string()
  .regex(/^[a-h][1-8]$/, "Expected a board square like e2");

export const playMoveInputSchema = z.object({
  from: squareSchema,
  to: squareSchema,
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
});

export type PlayMoveInputFromSchema = z.infer<typeof playMoveInputSchema>;
