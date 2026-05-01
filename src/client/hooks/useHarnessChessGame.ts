import { useAgent } from "agents/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { HarnessChessAgent } from "../../agents/HarnessChessAgent";
import { createGameView } from "../../shared/chess";
import type { GameState, GameView, PlayMoveInput } from "../../shared/types";

/**
 * Connects to a single HarnessChessAgent instance over WebSocket and exposes the
 * game view, RPC helpers, and any error from the most recent action.
 *
 * Game state lives on the agent (a Cloudflare Durable Object). When the
 * agent calls setState, every connected client receives the new state via
 * `onStateUpdate` — no polling and no REST API for gameplay.
 */
export function useHarnessChessGame(gameId: string) {
  const [state, setLocalState] = useState<GameState | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPlayingMove, setIsPlayingMove] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    setLocalState(undefined);
    setError(undefined);
    setIsPlayingMove(false);
    setIsResetting(false);
  }, [gameId]);

  const agent = useAgent<HarnessChessAgent, GameState>({
    agent: "HarnessChessAgent",
    name: gameId,
    onStateUpdate: (next) => {
      setLocalState(next);
    },
  });

  // Derive GameView (board, legalMoves, ascii, status, turn) from the raw
  // GameState we just received. createGameView is shared with the server,
  // so the source-of-truth rules in chess.js stay consistent.
  const game: GameView | undefined = useMemo(
    () => (state ? createGameView(state) : undefined),
    [state],
  );

  const playMove = useCallback(
    async (move: PlayMoveInput) => {
      setError(undefined);
      setIsPlayingMove(true);
      try {
        // RPC over the same WebSocket. The agent broadcasts state updates
        // during this call; we await it just to surface errors via reject.
        await agent.stub.playUserMove(move);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Move failed");
      } finally {
        setIsPlayingMove(false);
      }
    },
    [agent],
  );

  const resetGame = useCallback(async () => {
    setError(undefined);
    setIsResetting(true);
    try {
      await agent.stub.resetGame();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reset failed");
    } finally {
      setIsResetting(false);
    }
  }, [agent]);

  return {
    agent,
    game,
    error,
    isPlayingMove,
    isResetting,
    playMove,
    resetGame,
  };
}
