import { Think, type StepContext } from "@cloudflare/think";
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

/**
 * Cloudflare Agent (Durable Object) that owns the chess game.
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
// Model id is centralised so logs and config stay in sync.
const MODEL_ID = "@cf/moonshotai/kimi-k2.5";
// const MODEL_ID = "@cf/google/gemma-4-26b-a4b-it";

export class ChessAgent extends Think<Env, GameState> {
  initialState = createInitialGameState("default");
  maxSteps = MAX_AGENT_TURN_STEPS;

  // Per-turn correlation id + start time, set in takeAgentTurn() and read
  // by onStepFinish. Lets us correlate a turn's logs across step boundaries
  // and the inference loop's async callbacks.
  private turnId = 0;
  private turnStart = 0;
  private stepStart = 0;

  getModel() {
    // Workers AI binding -> Vercel AI SDK adapter.
    // K2.6 supports tool calling and reasoning natively. Reasoning depth is
    // controlled by the OpenAI-compatible `reasoning_effort` field; "low"
    // keeps the agent fast for tool-calling without disabling thinking
    // entirely (sending the wrong shape for `chat_template_kwargs.thinking`
    // returns InferenceUpstreamError 1000).
    const workersAi = createWorkersAI({ binding: this.env.AI });

    return workersAi(MODEL_ID, { reasoning_effort: "low" });
  }

  /**
   * Fires after every step in the agentic loop. This is the cleanest place
   * to log inference success: we get finish reason, usage, tool calls, and
   * the request payload (incl. model id sent to Workers AI).
   *
   * Logged here rather than in onEvent because the chunk stream is noisy
   * (every text-delta/tool-input-delta) and lacks aggregated usage.
   */
  onStepFinish(ctx: StepContext) {
    const stepLatencyMs = Date.now() - this.stepStart;
    this.stepStart = Date.now();

    const toolCalls = ctx.toolCalls.map((c) => ({
      name: c.toolName,
      // Truncate to avoid pathological prompts blowing up logs.
      input: JSON.stringify(c.input).slice(0, 200),
    }));
    const toolResults = ctx.toolResults.map((r) => {
      const output = r.output as { ok?: boolean; error?: string } | undefined;
      return {
        name: r.toolName,
        ok: output?.ok,
        error: output?.error,
      };
    });

    console.log("[ChessAgent] step finished", {
      turnId: this.turnId,
      gameId: this.name,
      stepLatencyMs,
      finishReason: ctx.finishReason,
      // text is usually short (a sentence) — log it for visibility.
      text: ctx.text.slice(0, 200),
      toolCallCount: ctx.toolCalls.length,
      toolCalls,
      toolResults,
      usage: ctx.usage,
      warnings: ctx.warnings,
      // The provider stamps the actual model id it called on the response.
      // If this ever drifts from MODEL_ID, the binding is rerouting us.
      modelId: ctx.response.modelId,
    });
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
        inputSchema: playMoveToolInputSchema,
        execute: async ({ explanation, ...move }) => {
          const state = this.ensureGameState();

          if (!isAgentTurn(state)) {
            console.warn("[ChessAgent] playMove rejected: not agent's turn", {
              turnId: this.turnId,
              gameId: this.name,
              attempted: move,
              fen: state.fen,
            });
            return {
              ok: false,
              error: "It is not the agent's turn.",
              legalMoves: getLegalMovesForState(state),
            };
          }

          const result = tryApplyMove(state, move, explanation);

          if (!result.ok) {
            console.warn("[ChessAgent] playMove rejected: illegal move", {
              turnId: this.turnId,
              gameId: this.name,
              attempted: move,
              error: result.error,
              fen: state.fen,
            });
            return result;
          }

          // The model can request a move, but chess.js validates before we persist it.
          // setState() also broadcasts the new state to all connected clients.
          //
          // Clear `agentThinking` here — the move has landed, so the UI should
          // unlock immediately. Waiting for the inference stream to finish (the
          // `finally` in takeAgentTurn) adds seconds of dead time while the
          // model emits trailing text/tool chunks the user doesn't care about.
          // takeAgentTurn's finally block is now just a backstop for paths
          // that never reach this point (no legal move, upstream errors).
          this.setState({ ...result.state, agentThinking: false });

          console.log("[ChessAgent] playMove accepted", {
            turnId: this.turnId,
            gameId: this.name,
            move,
            san: result.move.san,
            fenAfter: result.state.fen,
          });

          return {
            ok: true,
            data: result.game,
          };
        },
      }),
    };
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
    let toolCallEvents = 0;

    // Full transcript of the AI SDK UI message stream for this turn.
    // Each entry is the parsed chunk Think handed us via onEvent. Set a
    // breakpoint in onDone() below and inspect `transcript` to see the
    // entire agent response — text deltas, tool calls, tool results,
    // finish events, etc.
    const transcript: Array<Record<string, unknown>> = [];

    this.turnId += 1;
    this.turnStart = Date.now();
    this.stepStart = Date.now();

    const beforeView = createGameView(before);
    console.log("[ChessAgent] turn start", {
      turnId: this.turnId,
      gameId: this.name,
      model: MODEL_ID,
      fen: before.fen,
      turn: beforeView.turn,
      moveCount: before.moves.length,
      promptChars: prompt.length,
    });

    // Broadcast "thinking" so connected clients can render an indicator
    // immediately, before the LLM produces its first event.
    this.setState({ ...before, agentThinking: true });

    try {
      await this.chat(prompt, {
        // Buffer every chunk + count tool-call events. Think hands us
        // JSON-stringified UI message stream parts (text-delta,
        // tool-input-delta, tool-call, tool-result, finish, ...).
        onEvent(json) {
          try {
            const chunk = JSON.parse(json) as Record<string, unknown>;
            transcript.push(chunk);
            if (chunk.type === "tool-call") toolCallEvents += 1;
          } catch {
            // Non-JSON chunk; keep the raw string so nothing is dropped.
            transcript.push({ type: "raw", value: json });
          }
        },
        onDone() {
          // Stream is complete. Set a breakpoint on the next line to inspect
          // the full transcript of the agent's response for this turn.
          // Also assembled into a few derived views for easier scanning.
          const fullText = transcript
            .filter((c) => c.type === "text-delta")
            .map((c) => c.delta)
            .join("");
          const toolCalls = transcript.filter((c) => c.type === "tool-call");
          const toolResults = transcript.filter(
            (c) => c.type === "tool-result",
          );
          const finish = transcript.find((c) => c.type === "finish");

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _agentResponse = {
            transcript,
            fullText,
            toolCalls,
            toolResults,
            finish,
          };
          // ^ breakpoint here. `_agentResponse` is in scope and contains
          // everything the model emitted this turn.
        },
        onError(error) {
          chatError = error;
        },
      });

      if (chatError) {
        // Workers AI errors arrive here as a string. Log the full payload
        // so we can correlate `InferenceUpstreamError` codes across runs.
        console.error("[ChessAgent] inference error", {
          turnId: this.turnId,
          gameId: this.name,
          model: MODEL_ID,
          fen: before.fen,
          totalLatencyMs: Date.now() - this.turnStart,
          toolCallEvents,
          error: chatError,
        });
        throw new Error(chatError);
      }

      const after = this.ensureGameState();
      const totalLatencyMs = Date.now() - this.turnStart;

      if (after.fen === before.fen) {
        // Inference returned cleanly but no playMove tool fired (or it failed
        // every time). Distinguish from upstream errors so we can tell whether
        // it's a model-quality issue vs an infra issue.
        console.error("[ChessAgent] turn produced no move", {
          turnId: this.turnId,
          gameId: this.name,
          model: MODEL_ID,
          fenBefore: before.fen,
          totalLatencyMs,
          toolCallEvents,
        });
        throw new Error("The agent did not produce a legal move.");
      }

      console.log("[ChessAgent] turn complete", {
        turnId: this.turnId,
        gameId: this.name,
        model: MODEL_ID,
        totalLatencyMs,
        toolCallEvents,
        movesBefore: before.moves.length,
        movesAfter: after.moves.length,
        fenAfter: after.fen,
      });
    } catch (error) {
      // Catch-all for anything that escaped onError (sync throws, etc.) so
      // we still see something in logs before the RPC rejection bubbles up.
      console.error("[ChessAgent] turn failed", {
        turnId: this.turnId,
        gameId: this.name,
        model: MODEL_ID,
        totalLatencyMs: Date.now() - this.turnStart,
        toolCallEvents,
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error,
      });
      throw error;
    } finally {
      // ALWAYS clear the thinking flag, regardless of whether the turn
      // succeeded, errored, or the agent didn't produce a legal move.
      // Read latest state because the playMove tool may have mutated it.
      // Broadcast unconditionally — the WebSocket clients diff their own
      // state, and a redundant `agentThinking: false` write is cheaper than
      // a stuck loading spinner if the previous broadcast was somehow lost
      // or never fired (e.g. an exception between setState and finally).
      const current = this.ensureGameState();
      this.setState({ ...current, agentThinking: false });
    }
  }
}

function getLegalMovesForState(state: GameState) {
  return getLegalMoves(new Chess(state.fen));
}
