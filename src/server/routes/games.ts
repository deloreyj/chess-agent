import { getAgentByName } from "agents";
import { Hono } from "hono";

import { playMoveInputSchema } from "../../shared/schemas";
import type { Env } from "../env";

export const gamesRouter = new Hono<{ Bindings: Env }>();

gamesRouter.get("/:gameId", async (c) => {
  const agent = await getAgentByName(c.env.ChessAgent, c.req.param("gameId"));
  return c.json(await agent.getGame());
});

gamesRouter.post("/:gameId/moves", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = playMoveInputSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }

  const agent = await getAgentByName(c.env.ChessAgent, c.req.param("gameId"));

  try {
    return c.json(await agent.playUserMove(parsed.data));
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Move failed" },
      400,
    );
  }
});

gamesRouter.post("/:gameId/reset", async (c) => {
  const agent = await getAgentByName(c.env.ChessAgent, c.req.param("gameId"));
  return c.json(await agent.resetGame());
});
