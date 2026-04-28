import { describe, expect, it } from "vitest";

import {
  createAgentTurnPrompt,
  createGameView,
  createInitialGameState,
  INITIAL_FEN,
  isAgentTurn,
  isPlayerTurn,
  tryApplyMove,
} from "./chess";

describe("shared chess helpers", () => {
  it("creates the initial game view", () => {
    const state = createInitialGameState("game-1");
    const view = createGameView(state);

    expect(view.fen).toBe(INITIAL_FEN);
    expect(view.board).toHaveLength(64);
    expect(view.legalMoves).toHaveLength(20);
    expect(view.turn).toBe("w");
    expect(view.status).toBe("active");
    expect(isPlayerTurn(state)).toBe(true);
    expect(isAgentTurn(state)).toBe(false);
  });

  it("applies a legal move without mutating the original state", () => {
    const state = createInitialGameState("game-1");
    const result = tryApplyMove(state, { from: "e2", to: "e4" });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(state.fen).toBe(INITIAL_FEN);
    expect(result.move.san).toBe("e4");
    expect(result.game.moves).toHaveLength(1);
    expect(result.game.turn).toBe("b");
  });

  it("rejects an illegal move and returns legal moves", () => {
    const state = createInitialGameState("game-1");
    const result = tryApplyMove(state, { from: "e2", to: "e5" });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.error).toContain("Illegal move");
    expect(result.legalMoves.map((move) => move.uci)).toContain("e2e4");
  });

  it("includes board state and legal moves in the agent prompt", () => {
    const state = createInitialGameState("game-1");
    const prompt = createAgentTurnPrompt(createGameView(state));

    expect(prompt).toContain("Current board:");
    expect(prompt).toContain("FEN:");
    expect(prompt).toContain("Legal moves:");
    expect(prompt).toContain("- e2e4 (e4)");
    expect(prompt).toContain("You must call playMove");
  });
});
