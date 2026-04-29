import { z } from "zod";

import type { Square } from "chess.js";

// Use a plain string + regex (not z.custom) so this schema can be converted
// to JSON Schema by the AI SDK when it builds the tool definition for the
// LLM. z.custom() is opaque to JSON Schema generation and crashes the AI
// SDK at tool-prep time.
export const squareSchema = z
  .string()
  .regex(/^[a-h][1-8]$/, "Expected a board square like e2")
  .describe(
    "Algebraic chess square, e.g. 'e2'",
  ) as unknown as z.ZodType<Square>;

export const playMoveInputSchema = z.object({
  from: squareSchema,
  to: squareSchema,
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
});

export type PlayMoveInputFromSchema = z.infer<typeof playMoveInputSchema>;
