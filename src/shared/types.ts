import type { Color, PieceSymbol, Square } from "chess.js";

export type PlayerColor = Extract<Color, "w" | "b">;
export type PromotionPiece = Extract<PieceSymbol, "q" | "r" | "b" | "n">;

export type GameStatus =
  | "active"
  | "check"
  | "checkmate"
  | "draw"
  | "stalemate";

export type PlayMoveInput = {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
};

export type BoardSquare = {
  square: Square;
  file: string;
  rank: number;
  isLight: boolean;
  piece: PieceSymbol | null;
  color: Color | null;
};

export type LegalMove = {
  from: Square;
  to: Square;
  san: string;
  uci: string;
  promotion?: PieceSymbol;
  captured?: PieceSymbol;
};

export type MoveView = {
  from: Square;
  to: Square;
  san: string;
  uci: string;
  color: Color;
  promotion?: PieceSymbol;
  captured?: PieceSymbol;
};

export type RuntimeEvent = {
  id: string;
  at: number;
  label: string;
  detail?: string;
};

export type ChessPersonaStyle =
  | "balanced"
  | "aggressive"
  | "defensive"
  | "educational";

export type ChessPersona = {
  name: string;
  style: ChessPersonaStyle;
  instructions: string;
};

export type StrategyProfile = {
  currentPlan?: string;
  playerTrends: string[];
  notes: string[];
  updatedAt?: number;
};

export type BoardTheme = {
  name: string;
  light: string;
  dark: string;
  whitePiece: string;
  blackPiece: string;
  accent: string;
};

export type ChessPlayerState = GameState & {
  persona: ChessPersona;
  strategyProfile: StrategyProfile;
};

export type DirectorAction = {
  id: string;
  at: number;
  label: string;
  detail?: string;
};

export type SystemState = {
  systemId: string;
  playerAgentName: string;
  boardTheme: BoardTheme;
  directorThinking: boolean;
  // Mirrored from the player sub-agent for director prompts and the control room.
  // SystemPlayerAgent remains the source of truth for chess state and strategy.
  strategyNotes: string[];
  playerTrends: string[];
  recentDirectorActions: DirectorAction[];
  persona: ChessPersona;
  playerGame?: ChessPlayerState;
};

export type GameState = {
  gameId: string;
  fen: string;
  moves: MoveView[];
  playerColor: PlayerColor;
  agentColor: PlayerColor;
  lastAgentExplanation?: string;
  // True while the LLM is taking its turn. Broadcast through agent state
  // so every connected client renders the same "thinking..." indicator.
  agentThinking: boolean;
  runtimeEvents: RuntimeEvent[];
};

export type GameView = GameState & {
  ascii: string;
  board: BoardSquare[];
  turn: Color;
  status: GameStatus;
  legalMoves: LegalMove[];
};

export type MoveFailure = {
  ok: false;
  error: string;
  legalMoves: LegalMove[];
};

export type MoveSuccess = {
  ok: true;
  state: GameState;
  game: GameView;
  move: MoveView;
};

export type MoveResult = MoveSuccess | MoveFailure;
