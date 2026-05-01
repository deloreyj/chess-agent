import { createInitialGameState } from "./chess";
import type {
  BoardTheme,
  ChessPersona,
  ChessPlayerState,
  StrategyProfile,
  SystemState,
} from "./types";

// Defaults and mirror helpers live in shared code so the director, player, and
// React route do not each recreate the same system wiring rules.

export const DEFAULT_CHESS_PERSONA: ChessPersona = {
  name: "Kumo Gambit",
  style: "balanced",
  instructions:
    "Play sound chess, explain choices briefly, and adapt if the human repeats a pattern.",
};

export const DEFAULT_BOARD_THEME: BoardTheme = {
  name: "Workshop Classic",
  light: "#f2ead3",
  dark: "#8b6f47",
  whitePiece: "#fffaf0",
  blackPiece: "#1f2937",
  accent: "#f97316",
};

export function createSystemPlayerAgentName(systemId: string) {
  return `${systemId}-player`;
}

export function createDefaultChessPersona(): ChessPersona {
  return { ...DEFAULT_CHESS_PERSONA };
}

export function createDefaultBoardTheme(): BoardTheme {
  return { ...DEFAULT_BOARD_THEME };
}

export function createDefaultStrategyProfile(): StrategyProfile {
  return {
    playerTrends: [],
    notes: [],
  };
}

export function createInitialPlayerState(gameId: string): ChessPlayerState {
  return {
    ...createInitialGameState(gameId),
    persona: createDefaultChessPersona(),
    strategyProfile: createDefaultStrategyProfile(),
  };
}

export function createInitialSystemState(systemId: string): SystemState {
  return {
    systemId,
    playerAgentName: createSystemPlayerAgentName(systemId),
    boardTheme: createDefaultBoardTheme(),
    directorThinking: false,
    strategyNotes: [],
    playerTrends: [],
    recentDirectorActions: [],
    persona: createDefaultChessPersona(),
  };
}

export function mirrorPlayerState(
  state: SystemState,
  playerState: ChessPlayerState,
  playerGame: ChessPlayerState = playerState,
): SystemState {
  return {
    ...state,
    persona: playerState.persona,
    playerGame,
    playerTrends: playerState.strategyProfile.playerTrends,
    strategyNotes: playerState.strategyProfile.notes,
  };
}
