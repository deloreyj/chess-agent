import { routeAgentRequest } from "agents";
import { Hono } from "hono";

import { ChessAgent } from "../agents/ChessAgent";
import type { Env } from "./env";

// Re-export the Durable Object class so wrangler can find it.
export { ChessAgent };

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

export default {
  async fetch(request, env, ctx) {
    // Cloudflare Agents handle their own WebSocket and HTTP routes under
    // /agents/<agent-name>/<instance>. Gameplay and chat both flow through
    // that connection — there is no REST API for moves.
    const agentResponse = await routeAgentRequest(request, env);

    if (agentResponse) {
      return agentResponse;
    }

    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
