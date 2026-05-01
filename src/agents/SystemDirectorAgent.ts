import {
  Think,
  type ChatResponseResult,
  type StepContext,
  type StreamCallback,
  type ToolCallContext,
  type ToolCallResultContext,
  type TurnContext,
} from "@cloudflare/think";
import { callable } from "agents";
import { RpcTarget } from "cloudflare:workers";
import { tool, type ToolSet } from "ai";
import { z } from "zod";

import { isAgentTurn } from "../shared/chess";
import { boardThemeSchema, chessPersonaSchema } from "../shared/schemas";
import {
  createInitialSystemState,
  mirrorPlayerState,
} from "../shared/system";
import type {
  DirectorAction,
  GameView,
  SystemState,
  PlayMoveInput,
} from "../shared/types";
import { createChessModel, shouldAgentReply } from "./chessAgentCore";
import { SystemPlayerAgent } from "./SystemPlayerAgent";

const MAX_DIRECTOR_ACTIONS = 40;

/******** WHAT THE SYSTEM DIRECTOR OWNS ********/

// The director is the orchestration layer for the Stage 3 demo. It owns product
// state like board theme, action log, and prompt-time memory, then delegates all
// chess authority to the SystemPlayerAgent sub-agent.

/**
 * System director agent.
 *
 * The browser connects to this one agent for the system route. It owns the product
 * state (theme, memory, action log) and delegates chess authority to a
 * SystemPlayerAgent sub-agent. The mirrored playerGame is for UI sync only.
 */
export class SystemDirectorAgent extends Think<Env, SystemState> {
  initialState = createInitialSystemState("default");
  maxSteps = 6;

  /******** SYSTEM RPC ********/

  /** RPC: sync the player mirror and return the full system state. */
  @callable()
  async getSystem(): Promise<SystemState> {
    await this.syncPlayerState("Synced player state");
    return this.ensureSystemState();
  }

  /** RPC: reset both Durable Objects and clear the director transcript. */
  @callable()
  async resetSystem(): Promise<SystemState> {
    const base = createInitialSystemState(this.name);
    this.setState(base);
    this.clearMessages();

    const player = await this.getPlayer(base.playerAgentName);
    const playerGame = await player.resetGame();
    const playerState = await player.getPlayerState();

    const state = this.withAction(
      mirrorPlayerState(base, playerState),
      "Reset system",
      `New game at ${playerGame.fen}`,
    );
    this.setState(state);
    return state;
  }

  /**
   * RPC: send the human move to the player sub-agent, mirror the intermediate
   * state, then let the player answer when the game is still active.
   */
  @callable()
  async playUserMove(input: PlayMoveInput): Promise<SystemState> {
    const state = this.ensureSystemState();
    const player = await this.getPlayer(state.playerAgentName);

    if (state.playerGame?.agentThinking) {
      throw new Error("The player sub-agent is already thinking.");
    }

    try {
      const playerMove = await player.applyUserMove(input);
      const agentShouldMove =
        isAgentTurn(playerMove) && shouldAgentReply(playerMove);

      await this.syncPlayerState("Player move applied", formatMove(input), {
        agentThinking: agentShouldMove,
      });

      if (agentShouldMove) {
        const agentMove = await player.takeAgentTurnIfNeeded();
        await this.syncPlayerState(
          "Player sub-agent moved",
          formatLastMove(agentMove),
        );
      }

      return this.ensureSystemState();
    } catch (error) {
      await this.syncPlayerState("Player move failed", formatUnknownError(error));
      throw error;
    }
  }

  /** RPC/tool target: update the player's runtime persona through state. */
  @callable()
  async setChessPersona(
    input: z.infer<typeof chessPersonaSchema>,
  ): Promise<SystemState> {
    const state = this.ensureSystemState();
    const player = await this.getPlayer(state.playerAgentName);
    const playerState = await player.setPersona(input);
    const latestState = this.ensureSystemState();
    const nextState = this.withAction(
      mirrorPlayerState(latestState, playerState),
      "Updated player persona",
      `${playerState.persona.name} · ${playerState.persona.style}`,
    );

    this.setState(nextState);
    return nextState;
  }

  /** RPC/tool target: update the visual board theme in constrained state. */
  @callable()
  async setBoardTheme(input: z.infer<typeof boardThemeSchema>): Promise<SystemState> {
    const state = this.ensureSystemState();
    const player = await this.getPlayer(state.playerAgentName);
    const playerState = await player.getPlayerState();
    const latestState = this.ensureSystemState();
    const nextState = this.withAction(
      mirrorPlayerState({ ...latestState, boardTheme: input }, playerState),
      "Updated board theme",
      input.name,
    );

    this.setState(nextState);
    return nextState;
  }

  /** RPC/tool target: store strategy memory on the player sub-agent. */
  @callable()
  async saveStrategyNote(input: {
    note: string;
    playerTrend?: string;
    currentPlan?: string;
  }): Promise<SystemState> {
    const state = this.ensureSystemState();
    const note = input.note.trim();
    const trend = input.playerTrend?.trim();

    if (!note) {
      throw new Error("Strategy note cannot be empty.");
    }

    const player = await this.getPlayer(state.playerAgentName);
    const playerState = await player.setStrategyProfile({
      note,
      playerTrend: trend,
      currentPlan: input.currentPlan,
    });
    const latestState = this.ensureSystemState();
    const nextState = this.withAction(
      mirrorPlayerState(latestState, playerState),
      "Saved strategy memory",
      note,
    );

    this.setState(nextState);
    return nextState;
  }

  /******** SYSTEM STATE HELPERS ********/

  private ensureSystemState(): SystemState {
    if (this.state.systemId === this.name) {
      return this.state;
    }

    const state = createInitialSystemState(this.name);
    this.setState(state);
    return state;
  }

  private getPlayer(playerAgentName = this.ensureSystemState().playerAgentName) {
    return this.subAgent(SystemPlayerAgent, playerAgentName);
  }

  /**
   * The player sub-agent is the source of truth for chess state. The director
   * keeps a mirror so its prompt and the control-room UI can show the current
   * board/persona without asking the player on every render.
   */
  private async syncPlayerState(
    label: string,
    detail?: string,
    options?: { agentThinking?: boolean },
  ) {
    const state = this.ensureSystemState();
    const player = await this.getPlayer(state.playerAgentName);
    const playerState = await player.getPlayerState();
    const latestState = this.ensureSystemState();
    const visiblePlayerState =
      options?.agentThinking === undefined
        ? playerState
        : { ...playerState, agentThinking: options.agentThinking };
    const nextState = this.withAction(
      mirrorPlayerState(latestState, playerState, visiblePlayerState),
      label,
      detail,
    );

    this.setState(nextState);
  }

  private withAction(state: SystemState, label: string, detail?: string): SystemState {
    const action: DirectorAction = {
      id: crypto.randomUUID(),
      at: Date.now(),
      label,
      detail,
    };

    return {
      ...state,
      recentDirectorActions: [
        ...state.recentDirectorActions,
        action,
      ].slice(-MAX_DIRECTOR_ACTIONS),
    };
  }

  /******** THINK HARNESS CONFIG ********/

  getModel() {
    return createChessModel(this.env, this.sessionAffinity);
  }

  getSystemPrompt() {
    const state = this.ensureSystemState();
    return `You are the Chess System director agent.

Your job is not to play chess directly. Your job is to coordinate the specialized chess player sub-agent and safely change the system experience.

Rules:
- Delegate chess questions or move analysis to askChessPlayer.
- Update board appearance only through setBoardTheme.
- Update player behavior only through setChessPersona or saveStrategyNote.
- Treat requests for a "mode" or character transformation as runtime experience changes. Examples: goblin mode, pirate mode, robot mode, vampire mode, cozy teacher mode.
- For mode requests, usually call both setChessPersona and setBoardTheme. The persona instructions should rewrite the player's runtime identity, speaking style, priorities, and move-explanation flavor. The theme should visually match the same mode.
- Persona changes are prompt changes. Make instructions vivid and durable enough that direct Player Chat and future move explanations sound like that character, while still obeying legal-chess and workshop-safety rules.
- Pick the closest allowed style: aggressive for chaotic/tactical/greedy personas, defensive for cautious personas, educational for coach/teacher personas, balanced otherwise.
- Keep changes explainable and workshop-friendly.
- Never claim source code was changed. Runtime customization happens through persisted state and constrained tools.

Current player persona: ${state.persona.name} (${state.persona.style})
Persona instructions: ${state.persona.instructions}
Board theme: ${state.boardTheme.name}
Strategy notes: ${state.strategyNotes.join(" | ") || "None yet."}
Player trends: ${state.playerTrends.join(" | ") || "None yet."}`;
  }

  getTools(): ToolSet {
    return {
      inspectSystem: tool({
        description:
          "Inspect the current system state, including theme, persona, memory, and mirrored chess state.",
        inputSchema: z.object({}),
        execute: async () => {
          await this.syncPlayerState("Director inspected system");
          return { ok: true, data: this.ensureSystemState() };
        },
      }),
      askChessPlayer: tool({
        description:
          "Delegate a chess-specific question or analysis task to the player sub-agent.",
        inputSchema: z.object({
          prompt: z.string().min(1).max(1200),
        }),
        execute: async ({ prompt }) => {
          const state = this.ensureSystemState();
          const player = await this.getPlayer(state.playerAgentName);
          const relay = new PlayerStreamRelay(
            () => undefined,
            () => this.recordDirectorAction("Player sub-agent answered"),
            (error) => this.recordDirectorAction("Player sub-agent error", error),
          );

          this.recordDirectorAction("Delegated to player sub-agent", prompt);
          await player.chat(prompt, relay);
          await this.syncPlayerState("Synced after player delegation");

          return {
            ok: true,
            summary: await player.getGameSummary(),
          };
        },
      }),
      setChessPersona: tool({
        description:
          "Safely rewrite the chess player's runtime persona prompt through state, not code mutation. Use this for character modes and include vivid speaking style, decision priorities, and explanation flavor.",
        inputSchema: chessPersonaSchema,
        execute: async (input) => ({
          ok: true,
          data: await this.setChessPersona(input),
        }),
      }),
      setBoardTheme: tool({
        description:
          "Safely update the board theme shown in the system UI. For mode requests, match the theme to the new player persona.",
        inputSchema: boardThemeSchema,
        execute: async (input) => ({
          ok: true,
          data: await this.setBoardTheme(input),
        }),
      }),
      saveStrategyNote: tool({
        description:
          "Persist a strategy note, player trend, or plan so future player turns can adapt.",
        inputSchema: z.object({
          note: z.string().min(1).max(400),
          playerTrend: z.string().min(1).max(300).optional(),
          currentPlan: z.string().min(1).max(400).optional(),
        }),
        execute: async (input) => ({
          ok: true,
          data: await this.saveStrategyNote(input),
        }),
      }),
      summarizePlayerTrends: tool({
        description: "Return the current player trends and strategy notes.",
        inputSchema: z.object({}),
        execute: async () => {
          const state = this.ensureSystemState();
          return {
            ok: true,
            playerTrends: state.playerTrends,
            strategyNotes: state.strategyNotes,
          };
        },
      }),
    };
  }

  /******** THINK LIFECYCLE METHODS ********/

  beforeTurn(ctx: TurnContext) {
    const state = this.ensureSystemState();
    this.setState({ ...state, directorThinking: true });
    this.recordDirectorAction(
      "director beforeTurn",
      ctx.continuation ? "continuation" : "new turn",
    );
  }

  beforeToolCall(ctx: ToolCallContext) {
    this.recordDirectorAction(`director tool: ${ctx.toolName}`, "started");
  }

  afterToolCall(ctx: ToolCallResultContext) {
    this.recordDirectorAction(
      `director tool result: ${ctx.toolName}`,
      ctx.success
        ? `ok in ${Math.round(ctx.durationMs)}ms`
        : `error in ${Math.round(ctx.durationMs)}ms`,
    );
  }

  onStepFinish(ctx: StepContext) {
    this.recordDirectorAction(
      "director onStepFinish",
      `finish: ${ctx.finishReason}`,
    );
  }

  onChatResponse(_result: ChatResponseResult) {
    const state = this.ensureSystemState();
    this.setState({ ...state, directorThinking: false });
    this.recordDirectorAction("director onChatResponse", "completed");
  }

  onChatError(error: unknown) {
    const state = this.ensureSystemState();
    this.setState({ ...state, directorThinking: false });
    this.recordDirectorAction("director onChatError", formatUnknownError(error));
    return super.onChatError(error);
  }

  /******** RUNTIME ACTION LOG HELPERS ********/

  private recordDirectorAction(label: string, detail?: string) {
    const state = this.ensureSystemState();
    this.setState(this.withAction(state, label, detail));
  }
}

/**
 * Relay lets the director await player.chat() without showing the player's raw
 * stream inside Director Chat. The player transcript still lives on the player
 * sub-agent, and the director records only high-level action-log events.
 */
class PlayerStreamRelay extends RpcTarget implements StreamCallback {
  constructor(
    private readonly onEventJson: (json: string) => void | Promise<void>,
    private readonly onDoneCallback: () => void | Promise<void>,
    private readonly onErrorCallback: (error: string) => void | Promise<void>,
  ) {
    super();
  }

  onEvent(json: string) {
    return this.onEventJson(json);
  }

  onDone() {
    return this.onDoneCallback();
  }

  onError(error: string) {
    return this.onErrorCallback(error);
  }
}

export { createInitialSystemState } from "../shared/system";

function formatMove(input: PlayMoveInput) {
  return `${input.from}${input.to}${input.promotion ?? ""}`;
}

function formatLastMove(game: GameView) {
  const lastMove = game.moves.at(-1);

  if (!lastMove) {
    return "No move recorded";
  }

  return `${lastMove.uci} (${lastMove.san})`;
}

function formatUnknownError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
