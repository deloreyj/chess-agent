export const gameKeys = {
  all: ["games"] as const,
  detail: (gameId: string) => [...gameKeys.all, gameId] as const,
};
