import { Text } from "@cloudflare/kumo/components/text";
import { useState, type CSSProperties } from "react";

import type {
  BoardSquare,
  BoardTheme,
  GameView,
  PlayMoveInput,
} from "../../shared/types";

const pieceIcons: Record<string, string> = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};

type BoardProps = {
  game: GameView;
  disabled: boolean;
  onMove: (move: PlayMoveInput) => void;
  theme?: BoardTheme;
};

type BoardStyle = CSSProperties & {
  "--board-light": string;
  "--board-dark": string;
  "--board-white-piece": string;
  "--board-black-piece": string;
  "--board-accent": string;
};

export function Board({ game, disabled, onMove, theme }: BoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<BoardSquare | null>(
    null,
  );
  const boardStyle: BoardStyle | undefined = theme
    ? {
        "--board-light": theme.light,
        "--board-dark": theme.dark,
        "--board-white-piece": theme.whitePiece,
        "--board-black-piece": theme.blackPiece,
        "--board-accent": theme.accent,
      }
    : undefined;

  function handleSquareClick(square: BoardSquare) {
    if (disabled || game.turn !== game.playerColor) {
      return;
    }

    if (!selectedSquare) {
      if (square.color === game.playerColor) {
        setSelectedSquare(square);
      }

      return;
    }

    if (selectedSquare.square === square.square) {
      setSelectedSquare(null);
      return;
    }

    if (square.color === game.playerColor) {
      setSelectedSquare(square);
      return;
    }

    const move: PlayMoveInput = {
      from: selectedSquare.square,
      to: square.square,
    };

    if (isPromotionAttempt(selectedSquare, square)) {
      move.promotion = "q";
    }

    setSelectedSquare(null);
    onMove(move);
  }

  return (
    <div className="board-wrap">
      <div
        className="board"
        role="grid"
        aria-label="Chess board"
        style={boardStyle}
      >
        {game.board.map((square) => {
          const icon = square.piece
            ? pieceIcons[`${square.color}${square.piece}`]
            : "";
          const selected = selectedSquare?.square === square.square;

          return (
            <button
              key={square.square}
              type="button"
              role="gridcell"
              className={`board-square ${square.isLight ? "light" : "dark"} ${
                selected ? "selected" : ""
              }`}
              aria-label={squareLabel(square)}
              disabled={disabled}
              onClick={() => handleSquareClick(square)}
            >
              <span className={`piece ${square.color ?? "empty"}`}>{icon}</span>
              <span className="square-label">{square.square}</span>
            </button>
          );
        })}
      </div>

      <Text variant="secondary">
        {selectedSquare
          ? `Selected ${selectedSquare.square}`
          : "Select one of your pieces, then its target square."}
      </Text>
    </div>
  );
}

function isPromotionAttempt(from: BoardSquare, to: BoardSquare) {
  return (
    from.piece === "p" &&
    ((from.color === "w" && to.rank === 8) ||
      (from.color === "b" && to.rank === 1))
  );
}

function squareLabel(square: BoardSquare) {
  if (!square.piece || !square.color) {
    return `${square.square}, empty`;
  }

  return `${square.square}, ${square.color === "w" ? "white" : "black"} ${square.piece}`;
}
