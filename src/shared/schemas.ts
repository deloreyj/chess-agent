import { z } from "zod";

import type { Square } from "chess.js";

export const squareSchema = z.custom<Square>(
  (value) => typeof value === "string" && /^[a-h][1-8]$/.test(value),
  "Expected a board square like e2",
);

export const playMoveInputSchema = z.object({
  from: squareSchema,
  to: squareSchema,
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
});

export type PlayMoveInputFromSchema = z.infer<typeof playMoveInputSchema>;
