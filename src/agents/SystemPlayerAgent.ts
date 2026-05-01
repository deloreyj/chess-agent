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
import { z } from "zod";

import {
  createAgentTurnPrompt,
  createGameView,
  isAgentTurn,
  isPlayerTurn,
  tryApplyMove,
} from "../shared/chess";
import { INTERNAL_TURN_MESSAGE_ID_PREFIX } from "../shared/messages";
import { chessPersonaSchema, playMoveInputSchema } from "../shared/schemas";
import {
  createDefaultChessPersona,
  createDefaultStrategyProfile,
  createInitialPlayerState,
} from "../shared/system";
import type {
  ChessPersona,
  ChessPlayerState,
  GameState,
  GameView,
  PlayMoveInput,
} from "../shared/types";
import {
  createChessModel,
  getLegalMovesForState,
  shouldAgentReply,
} from "./chessAgentCore";

const MAX_PLAYER_TURN_STEPS = 5;
const MAX_RUNTIME_EVENTS = 30;
const MAX_STRATEGY_MEMORY_ITEMS = 8;

/******** WHAT THE SYSTEM PLAYER OWNS ********/

// The player sub-agent is still a complete chess agent. It owns the FEN, move
// history, persona, and strategy memory. The director can ask it questions or
// update its runtime state, but legal move authority stays here and still runs
// through chess.js before anything is persisted.

const playMoveToolSchema = playMoveInputSchema.extend({
  explanation: z
    .string()
    .max(240)
    .optional()
    .describe("One short sentence explaining why this move was chosen."),
});

/**
 * Specialized chess-playing sub-agent for the system route.
 *
 * The director can change this agent's persona and strategy profile, but this
 * agent remains authoritative for FEN and move history. Every persisted move
 * still goes through chess.js via tryApplyMove().
 */
export class SystemPlayerAgent extends Think<Env, ChessPlayerState> {
  initialState = createInitialPlayerState("default");
  maxSteps = MAX_PLAYER_TURN_STEPS;

  /******** GAMEPLAY RPC ********/

  /** RPC: return a derived game view for one-shot reads. */
  @callable()
  getGame(): GameView {
    return createGameView(this.ensurePlayerState());
  }

  /** RPC: expose the persisted player state for the director mirror and UI. */
  @callable()
  getPlayerState(): ChessPlayerState {
    return this.ensurePlayerState();
  }

  /** RPC: reset board state, persona, strategy memory, and chat transcript. */
  @callable()
  resetGame(): GameView {
    const state = createInitialPlayerState(this.name);
    this.setState(state);
    this.clearMessages();
    return createGameView(state);
  }

  /**
   * RPC: apply a human move and immediately let the player sub-agent answer if
   * the game is still active. The director route uses applyUserMove() directly
   * so it can mirror the intermediate state before this agent starts thinking.
   */
  @callable()
  async playUserMove(input: PlayMoveInput): Promise<GameView> {
    const playerMove = this.applyUserMove(input);

    if (isAgentTurn(playerMove) && shouldAgentReply(playerMove)) {
      await this.takeAgentTurn();
    }

    return createGameView(this.ensurePlayerState());
  }

  /** RPC: apply only the human move. chess.js rejects illegal input. */
  @callable()
  applyUserMove(input: PlayMoveInput): GameView {
    const state = this.ensurePlayerState();

    if (state.agentThinking) {
      throw new Error("The player sub-agent is already thinking.");
    }

    if (!isPlayerTurn(state)) {
      throw new Error("It is not the player's turn.");
    }

    const playerMove = tryApplyMove(state, input);

    if (!playerMove.ok) {
      throw new Error(playerMove.error);
    }

    const nextState = this.withPlayerContext(playerMove.state, state);
    this.setState({ ...nextState, agentThinking: false });

    return createGameView(this.ensurePlayerState());
  }

  /** RPC: continue the game only when it is actually the agent's turn. */
  @callable()
  async takeAgentTurnIfNeeded(): Promise<GameView> {
    const state = this.ensurePlayerState();
    const game = createGameView(state);

    if (isAgentTurn(state) && shouldAgentReply(game)) {
      await this.takeAgentTurn();
    }

    return createGameView(this.ensurePlayerState());
  }

  /******** DIRECTOR RPC ********/

  /** RPC/tool target: rewrite the runtime persona without changing source code. */
  @callable()
  setPersona(input: z.infer<typeof chessPersonaSchema>): ChessPlayerState {
    const state = this.ensurePlayerState();
    const persona: ChessPersona = {
      name: input.name?.trim() || state.persona.name,
      style: input.style,
      instructions: input.instructions.trim(),
    };

    const nextState = { ...state, persona };
    // Persona changes rewrite the runtime prompt identity, so discard the old
    // chat transcript to avoid anchoring future direct chat to the prior persona.
    this.clearMessages();
    this.setState(nextState);
    return nextState;
  }

  /** RPC/tool target: persist short strategic memories for future turns. */
  @callable()
  setStrategyProfile(input: {
    currentPlan?: string;
    note?: string;
    playerTrend?: string;
  }): ChessPlayerState {
    const state = this.ensurePlayerState();
    const currentPlan = input.currentPlan?.trim();
    const notes = appendStrategyMemory(state.strategyProfile.notes, input.note);
    const playerTrends = appendStrategyMemory(
      state.strategyProfile.playerTrends,
      input.playerTrend,
    );

    const nextState = {
      ...state,
      strategyProfile: {
        currentPlan: currentPlan || state.strategyProfile.currentPlan,
        notes,
        playerTrends,
        updatedAt: Date.now(),
      },
    };

    this.setState(nextState);
    return nextState;
  }

  /** RPC/tool target: compact summary for director delegation and debugging. */
  @callable()
  getGameSummary(): string {
    const game = createGameView(this.ensurePlayerState());
    return `Status: ${game.status}. FEN: ${game.fen}. Move history: ${
      game.moves.map((move) => move.san).join(" ") || "No moves yet"
    }. Legal moves: ${game.legalMoves.map((move) => move.uci).join(", ")}.`;
  }

  /******** PLAYER STATE HELPERS ********/

  private ensurePlayerState(): ChessPlayerState {
    if (this.state.gameId !== this.name) {
      const state = createInitialPlayerState(this.name);
      this.setState(state);
      return state;
    }

    if (this.state.persona && this.state.strategyProfile) {
      return this.state;
    }

    const state: ChessPlayerState = {
      ...this.state,
      persona: this.state.persona ?? createDefaultChessPersona(),
      strategyProfile:
        this.state.strategyProfile ?? createDefaultStrategyProfile(),
      runtimeEvents: this.state.runtimeEvents ?? [],
    };
    this.setState(state);
    return state;
  }

  private withPlayerContext(
    state: GameState,
    previous: ChessPlayerState,
  ): ChessPlayerState {
    return {
      ...state,
      persona: previous.persona,
      strategyProfile: previous.strategyProfile,
      runtimeEvents: previous.runtimeEvents,
    };
  }

  /******** AGENT TURN LOOP ********/

  private async takeAgentTurn() {
    const before = this.ensurePlayerState();
    const prompt = createPlayerTurnPrompt(before);

    this.setState({ ...before, agentThinking: true });

    try {
      // saveMessages streams this server-initiated turn through the Think
      // harness. The LLM must call playMove, and that tool validates via chess.js.
      await this.saveMessages([
        {
          id: `${INTERNAL_TURN_MESSAGE_ID_PREFIX}${crypto.randomUUID()}`,
          role: "user",
          parts: [{ type: "text", text: prompt }],
        },
      ]);

      const after = this.ensurePlayerState();

      if (after.fen === before.fen) {
        throw new Error("The player sub-agent did not produce a legal move.");
      }
    } finally {
      const current = this.ensurePlayerState();
      this.setState({ ...current, agentThinking: false });
    }
  }

  /******** THINK HARNESS CONFIG ********/

  getModel() {
    return createChessModel(this.env, this.sessionAffinity);
  }

  getSystemPrompt() {
    const state = this.ensurePlayerState();
    return `You are ${state.persona.name}, the chess-playing sub-agent in the Chess System.

Stable rules:
- You play black unless the game state says otherwise.
- Chat in your current persona when the user talks to you directly.
- Treat your persona instructions as your active runtime identity, not a light style hint. If they say you are a goblin, pirate, robot, coach, or other character, speak and explain chess from that character's point of view.
- Only make a chess move when an internal turn prompt asks for one or when the user explicitly asks you to take a move.
- When you make a chess move, you must call playMove.
- Never claim a move has been played unless playMove returns ok: true.
- chess.js validates every move before it is persisted.
- Keep explanations short and useful for a workshop audience, but let your persona color the language.

Current persona style: ${state.persona.style}
Persona instructions: ${state.persona.instructions}
Current plan: ${state.strategyProfile.currentPlan ?? "No plan recorded yet."}
Strategy notes: ${state.strategyProfile.notes.join(" | ") || "None yet."}
Observed player trends: ${state.strategyProfile.playerTrends.join(" | ") || "None yet."}`;
  }

  getTools(): ToolSet {
    return {
      inspectGameState: tool({
        description:
          "Inspect the current chess game state, including board, legal moves, persona, and strategy memory.",
        inputSchema: z.object({}),
        execute: async () => {
          const state = this.ensurePlayerState();

          return {
            ok: true,
            data: createGameView(state),
            persona: state.persona,
            strategyProfile: state.strategyProfile,
          };
        },
      }),
      playMove: tool({
        description:
          "Play the agent's chess move. The move must be legal for the current side to move.",
        inputSchema: playMoveToolSchema,
        execute: async (input) => {
          const state = this.ensurePlayerState();

          if (!isAgentTurn(state)) {
            return {
              ok: false,
              error: "It is not the agent's turn.",
              legalMoves: getLegalMovesForState(state),
            };
          }

          const result = tryApplyMove(state, {
            from: input.from,
            to: input.to,
            promotion: input.promotion,
          });

          if (!result.ok) {
            return result;
          }

          const nextState = this.withPlayerContext(result.state, state);
          this.setState({
            ...nextState,
            agentThinking: false,
            lastAgentExplanation: input.explanation,
          });

          return {
            ok: true,
            data: createGameView(this.ensurePlayerState()),
          };
        },
      }),
      setPersona: tool({
        description:
          "Safely update the chess player persona through persisted state, not source code.",
        inputSchema: chessPersonaSchema,
        execute: async (input) => ({
          ok: true,
          data: this.setPersona(input),
        }),
      }),
      updateStrategyProfile: tool({
        description:
          "Persist a current plan, strategy note, or observed player trend for future turns.",
        inputSchema: z.object({
          currentPlan: z.string().min(1).max(400).optional(),
          note: z.string().min(1).max(400).optional(),
          playerTrend: z.string().min(1).max(300).optional(),
        }),
        execute: async (input) => ({
          ok: true,
          data: this.setStrategyProfile(input),
        }),
      }),
      summarizePosition: tool({
        description:
          "Return a concise summary of the current position and legal moves.",
        inputSchema: z.object({}),
        execute: async () => ({ ok: true, summary: this.getGameSummary() }),
      }),
    };
  }

  /******** THINK LIFECYCLE METHODS ********/

  beforeTurn(ctx: TurnContext) {
    this.recordRuntimeEvent(
      "player beforeTurn",
      ctx.continuation ? "continuation" : "new turn",
    );
  }

  beforeToolCall(ctx: ToolCallContext) {
    this.recordRuntimeEvent(`player tool: ${ctx.toolName}`, "started");
  }

  afterToolCall(ctx: ToolCallResultContext) {
    this.recordRuntimeEvent(
      `player tool result: ${ctx.toolName}`,
      ctx.success
        ? `ok in ${Math.round(ctx.durationMs)}ms`
        : `error in ${Math.round(ctx.durationMs)}ms`,
    );
  }

  onStepFinish(ctx: StepContext) {
    this.recordRuntimeEvent("player onStepFinish", `finish: ${ctx.finishReason}`);
  }

  onChatResponse(_result: ChatResponseResult) {
    this.recordRuntimeEvent("player onChatResponse", "completed");
  }

  onChatError(error: unknown) {
    this.recordRuntimeEvent("player onChatError", formatUnknownError(error));
    return super.onChatError(error);
  }

  /******** RUNTIME TIMELINE HELPERS ********/

  private recordRuntimeEvent(label: string, detail?: string) {
    const state = this.ensurePlayerState();
    const runtimeEvents = [
      ...state.runtimeEvents,
      { id: crypto.randomUUID(), at: Date.now(), label, detail },
    ].slice(-MAX_RUNTIME_EVENTS);

    this.setState({ ...state, runtimeEvents });
  }
}

export { createInitialPlayerState } from "../shared/system";

function createPlayerTurnPrompt(state: ChessPlayerState) {
  return `${createAgentTurnPrompt(createGameView(state))}

Persona: ${state.persona.name} (${state.persona.style})
Persona instructions: ${state.persona.instructions}
Current plan: ${state.strategyProfile.currentPlan ?? "No plan recorded yet."}
Strategy notes: ${state.strategyProfile.notes.join(" | ") || "None yet."}
Observed player trends: ${state.strategyProfile.playerTrends.join(" | ") || "None yet."}`;
}

function appendStrategyMemory(values: string[], value?: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return values;
  }

  return [...values, trimmed].slice(-MAX_STRATEGY_MEMORY_ITEMS);
}

function formatUnknownError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
