import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getGame, playMove, resetGame } from "../api/gameApi";
import { gameKeys } from "../api/queryKeys";
import type { GameView, PlayMoveInput } from "../../shared/types";

export function useGame(gameId: string) {
  return useQuery<GameView, Error>({
    queryKey: gameKeys.detail(gameId),
    queryFn: () => getGame(gameId),
  });
}

export function usePlayMove(gameId: string) {
  const queryClient = useQueryClient();

  return useMutation<GameView, Error, PlayMoveInput>({
    mutationFn: (move) => playMove(gameId, move),
    onSuccess: (game) => {
      queryClient.setQueryData(gameKeys.detail(gameId), game);
    },
  });
}

export function useResetGame(gameId: string) {
  const queryClient = useQueryClient();

  return useMutation<GameView, Error>({
    mutationFn: () => resetGame(gameId),
    onSuccess: (game) => {
      queryClient.setQueryData(gameKeys.detail(gameId), game);
    },
  });
}
