import { Agent, callable } from "agents";
import { generateText, Output } from "ai";
import { z } from "zod";

import {
  createAgentTurnPrompt,
  createGameView,
  createInitialGameState,
  isAgentTurn,
  isPlayerTurn,
  tryApplyMove,
} from "../shared/chess";
import { squareSchema } from "../shared/schemas";
import type { GameState, GameView, PlayMoveInput } from "../shared/types";
import {
  createChessModel,
  ensureGameState as ensureSharedGameState,
  shouldAgentReply,
} from "./chessAgentCore";

/******** WHAT BASE AGENT INCLUDES ********/

// The base Agent gives this class a stateful Durable Object instance,
// WebSocket connections, @callable() RPC, and setState() broadcasts to connected
// clients. It does not include the AI chat protocol, message persistence,
// streaming, tool continuation, or lifecycle hooks. This file owns that
// orchestration manually so the demo can show what Think removes.

const MAX_AGENT_MOVE_ATTEMPTS = 3;

const agentMoveSchema = z.object({
  from: squareSchema,
  to: squareSchema,
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
  explanation: z
    .string()
    .max(240)
    .describe("A brief explanation of why this legal move was chosen."),
});

/**
 * Baseline chess agent (Durable Object) that owns one chess game.
 *
 * Everything flows through the agent's WebSocket connection:
 *   - GameState is the agent's `state`. setState() broadcasts the new state
 *     to every connected client over the same WebSocket, so the React UI
 *     updates without polling.
 *   - Player moves arrive as @callable() RPC calls (agent.stub.playUserMove).
 *   - Agent moves are produced by a hand-written model call and retry loop.
 *
 * This is intentionally explicit for the workshop: the Agent provides durable
 * state, WebSocket RPC, and state broadcasts, while this class assembles the
 * prompt, calls the model, retries invalid responses, and persists only moves
 * accepted by chess.js.
 */
export class VanillaChessAgent extends Agent<Env, GameState> {
  initialState = createInitialGameState("default");

  /******** GAMEPLAY RPC ********/

  /**
   * RPC: get the full game view. Clients receive GameView via state broadcasts,
   * but they need legalMoves/board/etc. that are derived from fen. We compute
   * them here and the client also computes them locally to avoid a roundtrip.
   * This stays @callable() in case external callers want a one-shot read.
   */
  @callable()
  getGame(): GameView {
    return createGameView(this.ensureGameState());
  }

  /**
   * RPC: reset the game. Broadcasts new state to every connected client.
   */
  @callable()
  resetGame(): GameView {
    const state = createInitialGameState(this.name);
    this.setState(state);
    return createGameView(state);
  }

  /**
   * RPC: apply the player's move and, if it's now the agent's turn, run the
   * manual model/retry loop. The state broadcast lights up the UI; the client
   * awaits the promise just to surface errors via stub rejection.
   */
  @callable()
  async playUserMove(input: PlayMoveInput): Promise<GameView> {
    const state = this.ensureGameState();

    if (state.agentThinking) {
      throw new Error("The agent is already thinking.");
    }

    if (!isPlayerTurn(state)) {
      throw new Error("It is not the player's turn.");
    }

    const playerMove = tryApplyMove(state, input);

    if (!playerMove.ok) {
      throw new Error(playerMove.error);
    }

    // Force agentThinking off when broadcasting the player's move. tryApplyMove
    // spreads the previous state forward, so a prior turn that crashed before
    // its `finally` ran could leave the flag stuck `true`. Clearing it here
    // means takeAgentTurn() is the single place that ever sets it `true`.
    this.setState({ ...playerMove.state, agentThinking: false });

    if (
      isAgentTurn(playerMove.state) &&
      shouldAgentReply(playerMove.game)
    ) {
      await this.takeAgentTurn();
    }

    return createGameView(this.ensureGameState());
  }

  /******** SHARED GAME STATE HELPERS ********/

  private ensureGameState(): GameState {
    return ensureSharedGameState(this);
  }

  /******** MANUAL AGENT TURN LOOP ********/

  private async takeAgentTurn() {
    const before = this.ensureGameState();
    const model = createChessModel(this.env, this.sessionAffinity);
    const failures: string[] = [];

    // Broadcast "thinking" so connected clients can render an indicator
    // immediately, before the LLM produces a structured move response.
    this.setState({ ...before, agentThinking: true });

    try {
      for (let attempt = 1; attempt <= MAX_AGENT_MOVE_ATTEMPTS; attempt++) {
        console.log(`attempt: ${attempt}`, failures);
        const current = this.ensureGameState();
        const game = createGameView(current);
        const prompt = createVanillaPrompt(game, failures);
        const { output } = await generateText({
          model,
          output: Output.object({
            schema: agentMoveSchema,
            name: "AgentMove",
            description: "A single legal chess move and short explanation.",
          }),
          system: `You are a chess-playing agent.

Rules:
- You play black unless the game state says otherwise.
- Return exactly one legal move using from/to coordinates.
- Never invent a move outside the legal move list.
- chess.js validates the move before it is persisted, so prefer correctness over creativity.`,
          prompt,
        });
        const move = {
          from: output.from,
          to: output.to,
          promotion: output.promotion,
        };

        const result = tryApplyMove(current, move);

        if (result.ok) {
          // The model can request a move, but chess.js validates before we persist it.
          // setState() also broadcasts the new state to all connected clients.
          this.setState({
            ...result.state,
            agentThinking: false,
            lastAgentExplanation: output.explanation,
          });
          return;
        }

        failures.push(
          `Attempt ${attempt}: ${output.from}${output.to}${output.promotion ?? ""} failed: ${result.error}`,
        );
      }

      throw new Error(
        `The vanilla agent did not produce a legal move after ${MAX_AGENT_MOVE_ATTEMPTS} attempts.`,
      );
    } finally {
      const current = this.ensureGameState();
      this.setState({ ...current, agentThinking: false });
    }
  }
}

/******** PROMPT HELPERS ********/

function createVanillaPrompt(game: GameView, failures: string[]) {
  const retryContext =
    failures.length === 0
      ? ""
      : `\nPrevious invalid attempts:\n${failures.join("\n")}\nChoose a different legal move.`;

  return `${createAgentTurnPrompt(game)}

Respond with structured fields:
- from: origin square
- to: destination square
- promotion: q/r/b/n only when required
- explanation: one short sentence
${retryContext}`;
}
