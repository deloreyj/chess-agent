import type { GameView, PlayMoveInput } from "../../shared/types";

export async function getGame(gameId: string): Promise<GameView> {
  return readJson(fetch(`/api/games/${encodeURIComponent(gameId)}`));
}

export async function playMove(
  gameId: string,
  move: PlayMoveInput,
): Promise<GameView> {
  return readJson(
    fetch(`/api/games/${encodeURIComponent(gameId)}/moves`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(move),
    }),
  );
}

export async function resetGame(gameId: string): Promise<GameView> {
  return readJson(
    fetch(`/api/games/${encodeURIComponent(gameId)}/reset`, {
      method: "POST",
    }),
  );
}

async function readJson<T>(responsePromise: Promise<Response>): Promise<T> {
  const response = await responsePromise;
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;

  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "Request failed";

    throw new Error(message);
  }

  return body as T;
}
