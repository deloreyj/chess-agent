import { useAgent } from "agents/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { SystemDirectorAgent } from "../../agents/SystemDirectorAgent";
import type { SystemPlayerAgent } from "../../agents/SystemPlayerAgent";
import { createGameView } from "../../shared/chess";
import {
  createSystemPlayerAgentName,
  mirrorPlayerState,
} from "../../shared/system";
import type {
  ChessPlayerState,
  GameView,
  PlayMoveInput,
  SystemState,
} from "../../shared/types";

export function useChessSystem(systemId: string) {
  const [state, setLocalState] = useState<SystemState | undefined>(undefined);
  const [playerState, setPlayerState] = useState<ChessPlayerState | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPlayingMove, setIsPlayingMove] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const playerAgentName = createSystemPlayerAgentName(systemId);

  useEffect(() => {
    setLocalState(undefined);
    setPlayerState(undefined);
    setError(undefined);
    setIsPlayingMove(false);
    setIsResetting(false);
  }, [systemId]);

  const agent = useAgent<SystemDirectorAgent, SystemState>({
    agent: "SystemDirectorAgent",
    name: systemId,
    onStateUpdate: (next) => {
      setLocalState(next);
      if (next.playerGame) {
        setPlayerState(next.playerGame);
      }
    },
  });

  // The director mirrors the player, but a direct sub-agent subscription keeps
  // board state responsive while Player Chat or autonomous turns are streaming.
  const playerAgent = useAgent<SystemPlayerAgent, ChessPlayerState>({
    agent: "SystemDirectorAgent",
    name: systemId,
    sub: [{ agent: "SystemPlayerAgent", name: playerAgentName }],
    onStateUpdate: (next) => {
      if (next.gameId === playerAgentName) {
        setPlayerState(next);
      }
    },
  });

  const system = useMemo<SystemState | undefined>(() => {
    if (!state || !playerState) {
      return state;
    }

    return mirrorPlayerState(state, playerState);
  }, [playerState, state]);

  const refreshSystem = useCallback(async () => {
    setError(undefined);
    try {
      const next = await agent.stub.getSystem();
      setLocalState(next);
      if (next.playerGame) {
        setPlayerState(next.playerGame);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "System sync failed");
    }
  }, [agent]);

  useEffect(() => {
    void refreshSystem();
  }, [refreshSystem]);

  const game: GameView | undefined = useMemo(
    () => (system?.playerGame ? createGameView(system.playerGame) : undefined),
    [system],
  );

  const playMove = useCallback(
    async (move: PlayMoveInput) => {
      setError(undefined);
      setIsPlayingMove(true);
      try {
        const next = await agent.stub.playUserMove(move);
        setLocalState(next);
        if (next.playerGame) {
          setPlayerState(next.playerGame);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Move failed");
      } finally {
        setIsPlayingMove(false);
      }
    },
    [agent],
  );

  const resetSystem = useCallback(async () => {
    setError(undefined);
    setPlayerState(undefined);
    setIsResetting(true);
    try {
      const next = await agent.stub.resetSystem();
      setLocalState(next);
      if (next.playerGame) {
        setPlayerState(next.playerGame);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reset failed");
    } finally {
      setIsResetting(false);
    }
  }, [agent]);

  return {
    agent,
    playerAgent,
    system,
    game,
    error,
    isPlayingMove,
    isResetting,
    playMove,
    resetSystem,
    refreshSystem,
  };
}
