# Chess Agent Contributor Guide

## Purpose

This is a workshop app for Agents Day. It demonstrates a chess-playing Cloudflare Agent backed by Durable Objects, Workers AI, Hono, React, WebSocket RPC, and Kumo.

## Commands

- `npm run dev` starts the Cloudflare Vite dev server.
- `npm run typecheck` verifies TypeScript.
- `npm test` runs Vitest.
- `npm run build` builds the Worker and React app.
- `npm run deploy` deploys with Wrangler.

## Architecture Rules

- Keep workshop code small, explicit, and easy to teach.
- Use `chess.js` as the source of truth for legal moves and game status.
- The LLM can request actions through tools, but `chess.js` validates before any state is persisted.
- Use the Agent WebSocket connection for gameplay RPC, chat, and state broadcasts.
- Use Kumo via granular imports and standalone styles.
- Prefer shared types and schemas from `src/shared` instead of duplicating shapes.
- Add comments for Cloudflare Agents, Durable Objects, Workers bindings, and LLM safety boundaries. Avoid comments that restate obvious code.

## Initial Assumptions

- Human plays white.
- Agent plays black.
- The UI submits `{ from, to, promotion }` moves.
- The agent receives legal moves in its prompt and uses tools to play its move.
- No deterministic fallback move. If the agent cannot produce a valid move after retries, return a clear error.
