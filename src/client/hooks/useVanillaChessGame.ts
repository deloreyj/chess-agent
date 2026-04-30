import { useAgent } from "agents/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { VanillaChessAgent } from "../../agents/VanillaChessAgent";
import { createGameView } from "../../shared/chess";
import type { GameState, GameView, PlayMoveInput } from "../../shared/types";

/**
 * Connects to the baseline Agent implementation. Unlike the Think route, this
 * only exposes gameplay RPC and state sync; the server owns the model call and
 * retry loop manually.
 */
export function useVanillaChessGame(gameId: string) {
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

  const agent = useAgent<VanillaChessAgent, GameState>({
    agent: "VanillaChessAgent",
    name: gameId,
    onStateUpdate: (next) => {
      setLocalState(next);
    },
  });

  const game: GameView | undefined = useMemo(
    () => (state ? createGameView(state) : undefined),
    [state],
  );

  const playMove = useCallback(
    async (move: PlayMoveInput) => {
      setError(undefined);
      setIsPlayingMove(true);
      try {
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
    game,
    error,
    isPlayingMove,
    isResetting,
    playMove,
    resetGame,
  };
}
