import {
  Chess,
  DEFAULT_POSITION,
  type Color,
  type Move,
  type Square,
} from "chess.js";

import type {
  BoardSquare,
  GameState,
  GameStatus,
  GameView,
  LegalMove,
  MoveResult,
  MoveView,
  PlayMoveInput,
  PlayerColor,
} from "./types";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export const INITIAL_FEN = DEFAULT_POSITION;
export const DEFAULT_PLAYER_COLOR: PlayerColor = "w";
export const DEFAULT_AGENT_COLOR: PlayerColor = "b";

export function createInitialGameState(gameId: string): GameState {
  return {
    gameId,
    fen: INITIAL_FEN,
    moves: [],
    playerColor: DEFAULT_PLAYER_COLOR,
    agentColor: DEFAULT_AGENT_COLOR,
    agentThinking: false,
  };
}

export function createGameView(state: GameState): GameView {
  const chess = new Chess(state.fen);

  return {
    ...state,
    ascii: chess.ascii(),
    board: createBoardSquares(chess),
    turn: chess.turn(),
    status: getGameStatus(chess),
    legalMoves: getLegalMoves(chess),
  };
}

export function tryApplyMove(
  state: GameState,
  input: PlayMoveInput,
  explanation?: string,
): MoveResult {
  const chess = new Chess(state.fen);
  const legalMoves = getLegalMoves(chess);

  try {
    const move = chess.move(input);
    const moveView = createMoveView(move);
    const nextState: GameState = {
      ...state,
      fen: chess.fen(),
      moves: [...state.moves, moveView],
      lastAgentExplanation: explanation ?? state.lastAgentExplanation,
    };

    return {
      ok: true,
      state: nextState,
      game: createGameView(nextState),
      move: moveView,
    };
  } catch {
    return {
      ok: false,
      error: `Illegal move: ${formatMoveInput(input)}`,
      legalMoves,
    };
  }
}

export function getLegalMoves(chess: Chess): LegalMove[] {
  return chess.moves({ verbose: true }).map((move) => ({
    from: move.from,
    to: move.to,
    san: move.san,
    uci: createUciMove(move),
    promotion: move.promotion,
    captured: move.captured,
  }));
}

export function getGameStatus(chess: Chess): GameStatus {
  if (chess.isCheckmate()) {
    return "checkmate";
  }

  if (chess.isStalemate()) {
    return "stalemate";
  }

  if (chess.isDraw()) {
    return "draw";
  }

  if (chess.isCheck()) {
    return "check";
  }

  return "active";
}

export function isAgentTurn(state: GameState): boolean {
  return new Chess(state.fen).turn() === state.agentColor;
}

export function isPlayerTurn(state: GameState): boolean {
  return new Chess(state.fen).turn() === state.playerColor;
}

export function createAgentTurnPrompt(game: GameView): string {
  const legalMoves = game.legalMoves
    .map((move) => `- ${move.uci} (${move.san})`)
    .join("\n");

  return `You are playing ${colorName(game.agentColor)} in a chess game against a human.

Current board:

${game.ascii}

FEN: ${game.fen}
Move history: ${formatMoveHistory(game.moves)}
Side to move: ${colorName(game.turn)}
Legal moves:
${legalMoves}

Use the available tools to play exactly one move.
You must call playMove. Do not claim a move was played unless playMove returns ok: true.
If playMove returns ok: false, use the error and legal moves above to choose another move.`;
}

function createBoardSquares(chess: Chess): BoardSquare[] {
  return chess.board().flatMap((rank, rankIndex) =>
    rank.map((piece, fileIndex) => {
      const rankNumber = 8 - rankIndex;
      const file = FILES[fileIndex];
      const square = `${file}${rankNumber}` as Square;

      return {
        square,
        file,
        rank: rankNumber,
        isLight: (fileIndex + rankNumber) % 2 === 0,
        piece: piece?.type ?? null,
        color: piece?.color ?? null,
      };
    }),
  );
}

function createMoveView(move: Move): MoveView {
  return {
    from: move.from,
    to: move.to,
    san: move.san,
    uci: createUciMove(move),
    color: move.color,
    promotion: move.promotion,
    captured: move.captured,
  };
}

function createUciMove(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function formatMoveInput(input: PlayMoveInput): string {
  return `${input.from}${input.to}${input.promotion ?? ""}`;
}

function formatMoveHistory(moves: MoveView[]): string {
  if (moves.length === 0) {
    return "No moves yet";
  }

  const pairs: string[] = [];

  for (let i = 0; i < moves.length; i += 2) {
    const moveNumber = i / 2 + 1;
    const white = moves[i]?.san;
    const black = moves[i + 1]?.san;
    pairs.push(`${moveNumber}. ${white}${black ? ` ${black}` : ""}`);
  }

  return pairs.join(" ");
}

function colorName(color: Color): string {
  return color === "w" ? "white" : "black";
}
