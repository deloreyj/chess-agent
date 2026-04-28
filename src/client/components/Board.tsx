import { useMemo, useState } from "react";

import type { BoardSquare, GameView, PlayMoveInput } from "../../shared/types";

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
};

export function Board({ game, disabled, onMove }: BoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<BoardSquare | null>(null);
  const [promotion, setPromotion] = useState<PlayMoveInput["promotion"]>("q");
  const boardBySquare = useMemo(
    () => new Map(game.board.map((square) => [square.square, square])),
    [game.board],
  );

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

    const move: PlayMoveInput = {
      from: selectedSquare.square,
      to: square.square,
    };

    if (isPromotionAttempt(selectedSquare, square)) {
      move.promotion = promotion;
    }

    setSelectedSquare(null);
    onMove(move);
  }

  return (
    <div className="board-wrap">
      <div className="board" role="grid" aria-label="Chess board">
        {game.board.map((square) => {
          const icon = square.piece ? pieceIcons[`${square.color}${square.piece}`] : "";
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
              <span className="piece">{icon}</span>
              <span className="square-label">{square.square}</span>
            </button>
          );
        })}
      </div>

      <label className="promotion-control">
        Promotion
        <select
          value={promotion}
          onChange={(event) => setPromotion(event.currentTarget.value as PlayMoveInput["promotion"])}
        >
          <option value="q">Queen</option>
          <option value="r">Rook</option>
          <option value="b">Bishop</option>
          <option value="n">Knight</option>
        </select>
      </label>

      {selectedSquare ? (
        <p className="hint">Selected {boardBySquare.get(selectedSquare.square)?.square}</p>
      ) : (
        <p className="hint">Select one of your pieces, then its target square.</p>
      )}
    </div>
  );
}

function isPromotionAttempt(from: BoardSquare, to: BoardSquare) {
  return from.piece === "p" && ((from.color === "w" && to.rank === 8) || (from.color === "b" && to.rank === 1));
}

function squareLabel(square: BoardSquare) {
  if (!square.piece || !square.color) {
    return `${square.square}, empty`;
  }

  return `${square.square}, ${square.color === "w" ? "white" : "black"} ${square.piece}`;
}
