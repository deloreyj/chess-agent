import { Hono } from "hono";

import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

export class ChessAgent {
  constructor() {
    throw new Error("ChessAgent is implemented in a later phase.");
  }
}

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
