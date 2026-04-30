import { z } from "zod";

import { SQUARES } from "./squares";

// z.enum converts cleanly to JSON Schema for AI SDK tool definitions.
export const squareSchema = z.enum(SQUARES).describe("Algebraic chess square");

export const playMoveInputSchema = z.object({
  from: squareSchema,
  to: squareSchema,
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
});

export type PlayMoveInputFromSchema = z.infer<typeof playMoveInputSchema>;
