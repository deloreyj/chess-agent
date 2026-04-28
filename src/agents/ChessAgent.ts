import { Think } from "@cloudflare/think";
import { callable } from "agents";
import { tool, type ToolSet } from "ai";
import { Chess } from "chess.js";
import { z } from "zod";
import { createWorkersAI } from "workers-ai-provider";

import {
  createAgentTurnPrompt,
  createGameView,
  createInitialGameState,
  getLegalMoves,
  isAgentTurn,
  isPlayerTurn,
  tryApplyMove,
} from "../shared/chess";
import { playMoveInputSchema } from "../shared/schemas";
import type { GameState, GameView, PlayMoveInput } from "../shared/types";
import type { Env } from "../server/env";

const MAX_AGENT_TURN_STEPS = 4;

const playMoveToolInputSchema = playMoveInputSchema.extend({
  explanation: z
    .string()
    .min(1)
    .max(280)
    .describe("Short explanation of why this move was chosen."),
});

export class ChessAgent extends Think<Env, GameState> {
  initialState = createInitialGameState("default");
  maxSteps = MAX_AGENT_TURN_STEPS;

  getModel() {
    return createWorkersAI({ binding: this.env.AI })("@cf/moonshotai/kimi-k2.5");
  }

  getSystemPrompt() {
    return `You are a chess-playing agent.

Rules:
- You play black unless the game state says otherwise.
- You must make moves by calling playMove.
- You may inspect the current board with inspectGameState.
- Never claim a move has been played unless playMove returns ok: true.
- If playMove returns ok: false, use the error and legal moves from the prompt to choose another move.
- Prefer legal, sensible chess moves over verbose explanation.`;
  }

  getTools(): ToolSet {
    return {
      inspectGameState: tool({
        description: "Inspect the current chess game state, including an ASCII board.",
        inputSchema: z.object({}),
        execute: async () => ({
          ok: true,
          data: this.getGame(),
        }),
      }),
      playMove: tool({
        description:
          "Play the agent's move. The move must be legal for the current side to move.",
        inputSchema: playMoveToolInputSchema,
        execute: async ({ explanation, ...move }) => {
          const state = this.ensureGameState();

          if (!isAgentTurn(state)) {
            return {
              ok: false,
              error: "It is not the agent's turn.",
              legalMoves: getLegalMovesForState(state),
            };
          }

          const result = tryApplyMove(state, move, explanation);

          if (!result.ok) {
            return result;
          }

          // The model can request a move, but chess.js validates before we persist it.
          this.setState(result.state);

          return {
            ok: true,
            data: result.game,
          };
        },
      }),
    };
  }

  @callable()
  getGame(): GameView {
    return createGameView(this.ensureGameState());
  }

  @callable()
  resetGame(): GameView {
    const state = createInitialGameState(this.name);
    this.setState(state);
    this.clearMessages();
    return createGameView(state);
  }

  @callable()
  async playUserMove(input: PlayMoveInput): Promise<GameView> {
    const state = this.ensureGameState();

    if (!isPlayerTurn(state)) {
      throw new Error("It is not the player's turn.");
    }

    const playerMove = tryApplyMove(state, input);

    if (!playerMove.ok) {
      throw new Error(playerMove.error);
    }

    this.setState(playerMove.state);

    if (
      isAgentTurn(playerMove.state) &&
      (playerMove.game.status === "active" || playerMove.game.status === "check")
    ) {
      await this.takeAgentTurn();
    }

    return this.getGame();
  }

  private ensureGameState(): GameState {
    if (this.state.gameId === this.name) {
      return this.state;
    }

    const state = createInitialGameState(this.name);
    this.setState(state);
    return state;
  }

  private async takeAgentTurn() {
    const before = this.ensureGameState();
    const prompt = createAgentTurnPrompt(createGameView(before));
    let chatError: string | undefined;

    await this.chat(prompt, {
      onEvent() {},
      onDone() {},
      onError(error) {
        chatError = error;
      },
    });

    if (chatError) {
      throw new Error(chatError);
    }

    const after = this.ensureGameState();

    if (after.fen === before.fen) {
      throw new Error("The agent did not produce a legal move.");
    }
  }
}

function getLegalMovesForState(state: GameState) {
  return getLegalMoves(new Chess(state.fen));
}
