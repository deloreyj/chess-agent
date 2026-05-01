import { z } from "zod";

import { SQUARES } from "./squares";

// z.enum converts cleanly to JSON Schema for AI SDK tool definitions.
export const squareSchema = z.enum(SQUARES).describe("Algebraic chess square");

export const playMoveInputSchema = z.object({
  from: squareSchema,
  to: squareSchema,
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
});

export const chessPersonaSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(48)
    .optional()
    .describe("Short character or persona name for the chess player."),
  style: z
    .enum(["balanced", "aggressive", "defensive", "educational"])
    .describe("Chess tendency that best matches this persona."),
  instructions: z
    .string()
    .min(1)
    .max(600)
    .describe(
      "Runtime system-prompt instructions for how the player should speak, think, and choose moves while still obeying chess safety rules.",
    ),
});

export const boardThemeSchema = z.object({
  name: z.string().min(1).max(48).describe("Short name for the board theme."),
  light: z.string().min(3).max(32).describe("Light square color."),
  dark: z.string().min(3).max(32).describe("Dark square color."),
  whitePiece: z.string().min(3).max(32).describe("White piece color."),
  blackPiece: z.string().min(3).max(32).describe("Black piece color."),
  accent: z.string().min(3).max(32).describe("Selection and hover accent color."),
});
