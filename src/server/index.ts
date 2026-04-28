import { routeAgentRequest } from "agents";
import { Hono } from "hono";

import { ChessAgent } from "../agents/ChessAgent";
import type { Env } from "./env";
import { gamesRouter } from "./routes/games";

export { ChessAgent };

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/games", gamesRouter);

export default {
  async fetch(request, env, ctx) {
    const agentResponse = await routeAgentRequest(request, env);

    if (agentResponse) {
      return agentResponse;
    }

    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
