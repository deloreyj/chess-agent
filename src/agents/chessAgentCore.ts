import { Chess } from "chess.js";
import { createWorkersAI } from "workers-ai-provider";

import {
  createInitialGameState,
  getLegalMoves,
} from "../shared/chess";
import type { GameState, GameView } from "../shared/types";

export const CHESS_MODEL_ID = "@cf/moonshotai/kimi-k2.5";
export const CHESS_MODEL_OPTIONS = { reasoning_effort: "low" } as const;

type GameStateHost = {
  name: string;
  state: GameState;
  setState(state: GameState): void;
};

export function createChessModel(env: Env, sessionAffinity?: string) {
  const workersAi = createWorkersAI({ binding: env.AI });

  return workersAi(CHESS_MODEL_ID, {
    ...CHESS_MODEL_OPTIONS,
    ...(sessionAffinity ? { sessionAffinity } : {}),
  });
}

export function ensureGameState(host: GameStateHost): GameState {
  if (host.state.gameId === host.name) {
    if (host.state.runtimeEvents) {
      return host.state;
    }

    const state = { ...host.state, runtimeEvents: [] };
    host.setState(state);
    return state;
  }

  const state = createInitialGameState(host.name);
  host.setState(state);
  return state;
}

export function shouldAgentReply(game: GameView): boolean {
  return game.status === "active" || game.status === "check";
}

export function getLegalMovesForState(state: GameState) {
  return getLegalMoves(new Chess(state.fen));
}
