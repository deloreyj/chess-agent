# Chess Agent

A workshop app for Agents Day. It demonstrates the progression from a hand-rolled chess agent, to a Think-powered harnessed agent, to a small agentic system with a director agent coordinating a specialized player sub-agent.

The app uses React, Cloudflare Workers, Cloudflare Agents, Durable Objects, Workers AI, Hono, WebSocket RPC, `chess.js`, and Kumo.

## What You Can Try

- `/` shows the workshop narrative and links to each stage.
- `/agent` shows a single chess agent where the app owns the model call, retry loop, validation, and state updates.
- `/harness` shows the same chess behavior using Think for chat, streaming, tool execution, persistence, recovery, and lifecycle hooks.
- `/system` shows a director agent coordinating a player sub-agent, strategy memory, persona changes, and board theme updates.

Across all stages, the human plays white and the agent plays black. The LLM can propose moves, but `chess.js` validates every move before state is persisted.

## Prerequisites

- Node.js 22 or newer.
- npm.
- A Cloudflare account with Workers AI enabled if you want to run real model calls.
- Wrangler authentication for deployment: `npx wrangler login`.

## Getting Started

Install dependencies:

```sh
npm install
```

Start the local dev server:

```sh
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`.

Run validation before changing behavior:

```sh
npm run typecheck
npm test
npm run build
```

Deploy with Wrangler:

```sh
npm run deploy
```

## Project Map

- `src/server/index.ts` is the Worker entry point. It routes Cloudflare Agent requests first, then falls back to the Hono app.
- `src/agents/AgentChessAgent.ts` is Stage 1: a baseline Durable Object agent with manual orchestration.
- `src/agents/HarnessChessAgent.ts` is Stage 2: the same game through the Think harness.
- `src/agents/SystemDirectorAgent.ts` is Stage 3: the orchestration agent for the system route.
- `src/agents/SystemPlayerAgent.ts` is Stage 3: the chess-playing sub-agent that owns the game state.
- `src/agents/chessAgentCore.ts` holds shared model and agent helper functions.
- `src/shared/chess.ts` contains deterministic chess logic, legal move validation, game views, and prompts.
- `src/shared/system.ts` contains system defaults, initial state helpers, player-agent naming, and director mirror helpers.
- `src/shared/types.ts` and `src/shared/schemas.ts` define shared TypeScript types and Zod schemas.
- `src/client/routes/*Route.tsx` contains the React pages for the landing page and each stage.
- `src/client/components` contains reusable UI components like the board, status, controls, and agent chat panel.
- `wrangler.jsonc` defines the Worker, assets, Workers AI binding, Durable Object bindings, and migrations.

## Architecture Notes

Each chess game is a Durable Object-backed agent instance. Browser gameplay uses the Cloudflare Agents WebSocket connection for both RPC and state broadcasts.

The main safety boundary is deterministic validation:

1. The UI submits a move shape like `{ from, to, promotion }`.
2. The agent applies it with helpers from `src/shared/chess.ts`.
3. The LLM can request an agent move through a constrained tool.
4. `chess.js` validates the requested move before `setState()` persists and broadcasts it.

The Stage 3 system has two agents:

- `SystemDirectorAgent` owns product/system state: board theme, action log, mirrored player memory, and director chat.
- `SystemPlayerAgent` owns chess authority: FEN, move history, legal move validation, persona, strategy profile, and player chat.

The director can update the player through constrained RPC/tool calls, but it does not mutate source code or directly play chess.

## Common Commands

- `npm run dev` starts the Cloudflare Vite dev server.
- `npm run typecheck` verifies TypeScript.
- `npm test` runs Vitest.
- `npm run build` builds the Worker and React app.
- `npm run deploy` deploys with Wrangler.
- `npm run typegen` regenerates Worker binding types after changing `wrangler.jsonc`.

## Workshop Tips

- Start at `/agent` to show what the app has to own when it manually runs an agent loop.
- Move to `/harness` to show what Think takes over.
- Finish at `/system` to show delegation, runtime persona changes, state mirroring, and sub-agent coordination.
- Use the control room in `/system` to show how director state mirrors player state while the player remains the source of truth.
- Try prompts like “make the player a pirate and make the board feel nautical” in Director Chat.

## Contributing

See `AGENTS.md` for contributor guidance. The code is intentionally small, explicit, and workshop-oriented, so prefer clear control flow and deterministic validation over clever abstractions.
