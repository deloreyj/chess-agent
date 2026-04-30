import {
  Think,
  type ChatResponseResult,
  type StepContext,
  type ToolCallContext,
  type ToolCallResultContext,
  type TurnContext,
} from "@cloudflare/think";
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
import { INTERNAL_TURN_MESSAGE_ID_PREFIX } from "../shared/messages";
import { playMoveInputSchema } from "../shared/schemas";
import type { GameState, GameView, PlayMoveInput } from "../shared/types";
import type { Env } from "../server/env";

const MAX_AGENT_TURN_STEPS = 4;
const MAX_RUNTIME_EVENTS = 30;

/**
 * Think-powered chess agent (Durable Object) that owns one chess game.
 *
 * Everything flows through the agent's WebSocket connection:
 *   - GameState is the agent's `state`. setState() broadcasts the new state
 *     to every connected client over the same WebSocket, so the React UI
 *     updates without polling.
 *   - Player moves arrive as @callable() RPC calls (agent.stub.playUserMove).
 *   - Chat with the agent uses the inherited Think/AIChatAgent machinery on
 *     the same WebSocket via useAgentChat.
 *
 * Workshop-relevant safety boundary: the LLM proposes moves through the
 * playMove tool, but chess.js validates them before any state is persisted.
 */
const MODEL_ID = "@cf/moonshotai/kimi-k2.5";

export class ThinkChessAgent extends Think<Env, GameState> {
  initialState = createInitialGameState("default");
  maxSteps = MAX_AGENT_TURN_STEPS;

  getModel() {
    // Workers AI binding -> Vercel AI SDK adapter.
    const workersAi = createWorkersAI({ binding: this.env.AI });

    // Keep reasoning shallow so workshop turns stay fast while preserving tool use.
    return workersAi(MODEL_ID, { reasoning_effort: "low" });
  }

  getSystemPrompt() {
    return `You are a chess-playing agent.

Rules:
- You play black unless the game state says otherwise.
- You must make moves by calling playMove.
- You may inspect the current board with inspectGameState.
- Never claim a move has been played unless playMove returns ok: true.
- If playMove returns ok: false, use the error and legal moves from the prompt to choose another move.
- After a successful move, do not print the board, FEN, or legal move list.
- After a successful move, give only a brief explanation of the move and why you chose it.
- Prefer legal, sensible chess moves over verbose explanation.`;
  }

  getTools(): ToolSet {
    return {
      inspectGameState: tool({
        description:
          "Inspect the current chess game state, including an ASCII board.",
        inputSchema: z.object({}),
        execute: async () => ({
          ok: true,
          data: createGameView(this.ensureGameState()),
        }),
      }),
      playMove: tool({
        description:
          "Play the agent's move. The move must be legal for the current side to move.",
        inputSchema: playMoveInputSchema,
        execute: async (move) => {
          const state = this.ensureGameState();

          if (!isAgentTurn(state)) {
            return {
              ok: false,
              error: "It is not the agent's turn.",
              legalMoves: getLegalMovesForState(state),
            };
          }

          const result = tryApplyMove(state, move);

          if (!result.ok) {
            return result;
          }

          // The model can request a move, but chess.js validates before we persist it.
          // setState() also broadcasts the new state to all connected clients.
          this.setState({ ...result.state, agentThinking: false });

          return {
            ok: true,
            data: result.game,
          };
        },
      }),
    };
  }

  beforeTurn(ctx: TurnContext) {
    this.recordRuntimeEvent(
      "beforeTurn",
      ctx.continuation ? "continuation" : "new turn",
    );
  }

  beforeToolCall(ctx: ToolCallContext) {
    this.recordRuntimeEvent(`tool: ${ctx.toolName}`, "started");
  }

  afterToolCall(ctx: ToolCallResultContext) {
    this.recordRuntimeEvent(
      `tool result: ${ctx.toolName}`,
      ctx.success
        ? `ok in ${Math.round(ctx.durationMs)}ms`
        : `error in ${Math.round(ctx.durationMs)}ms`,
    );
  }

  onStepFinish(ctx: StepContext) {
    this.recordRuntimeEvent("onStepFinish", `finish: ${ctx.finishReason}`);
  }

  onChatResponse(_result: ChatResponseResult) {
    this.recordRuntimeEvent("onChatResponse", "completed");
  }

  onChatError(error: unknown) {
    this.recordRuntimeEvent("onChatError", formatUnknownError(error));
    return super.onChatError(error);
  }

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
   * RPC: reset the game. Broadcasts new state to every connected client and
   * clears the chat transcript on the agent.
   */
  @callable()
  resetGame(): GameView {
    const state = createInitialGameState(this.name);
    this.setState(state);
    this.clearMessages();
    return createGameView(state);
  }

  /**
   * RPC: apply the player's move and, if it's now the agent's turn, run the
   * agent loop. The state broadcast lights up the UI; the client awaits the
   * promise just to surface errors via stub rejection.
   */
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

    // Force agentThinking off when broadcasting the player's move. tryApplyMove
    // spreads the previous state forward, so a prior turn that crashed before
    // its `finally` ran could leave the flag stuck `true`. Clearing it here
    // means takeAgentTurn() is the single place that ever sets it `true`.
    this.setState({ ...playerMove.state, agentThinking: false });

    if (
      isAgentTurn(playerMove.state) &&
      (playerMove.game.status === "active" ||
        playerMove.game.status === "check")
    ) {
      await this.takeAgentTurn();
    }

    return createGameView(this.ensureGameState());
  }

  private ensureGameState(): GameState {
    if (this.state.gameId === this.name) {
      if (this.state.runtimeEvents) {
        return this.state;
      }

      const state = { ...this.state, runtimeEvents: [] };
      this.setState(state);
      return state;
    }

    const state = createInitialGameState(this.name);
    this.setState(state);
    return state;
  }

  private async takeAgentTurn() {
    const before = this.ensureGameState();
    const prompt = createAgentTurnPrompt(createGameView(before));

    // Broadcast "thinking" so connected clients can render an indicator
    // immediately, before the LLM produces its first event.
    this.setState({ ...before, agentThinking: true });

    try {
      // saveMessages streams the server-initiated turn to every connected client.
      await this.saveMessages([
        {
          id: `${INTERNAL_TURN_MESSAGE_ID_PREFIX}${crypto.randomUUID()}`,
          role: "user",
          parts: [{ type: "text", text: prompt }],
        },
      ]);

      const after = this.ensureGameState();

      if (after.fen === before.fen) {
        throw new Error("The agent did not produce a legal move.");
      }
    } finally {
      const current = this.ensureGameState();
      this.setState({ ...current, agentThinking: false });
    }
  }

  private recordRuntimeEvent(label: string, detail?: string) {
    const state = this.ensureGameState();
    const runtimeEvents = [
      ...state.runtimeEvents,
      {
        id: crypto.randomUUID(),
        at: Date.now(),
        label,
        detail,
      },
    ].slice(-MAX_RUNTIME_EVENTS);

    this.setState({ ...state, runtimeEvents });
  }
}

function getLegalMovesForState(state: GameState) {
  return getLegalMoves(new Chess(state.fen));
}

function formatUnknownError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
