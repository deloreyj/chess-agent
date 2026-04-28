# Chess Agent Workshop Plan

## Goal

Bootstrap a clear, concise workshop app for Agents Day: a chess agent that can play against a user in the browser.

The code should be simple enough to teach from, but structured well enough to show the right Cloudflare Workers and Agents patterns.

## Stack

- React SPA for the browser UI
- Hono for Worker API routes
- Cloudflare Workers as the runtime
- Cloudflare Vite plugin for local dev/build/deploy parity with Workers
- Cloudflare Agents SDK with `@cloudflare/think`
- Workers AI through `workers-ai-provider`
- React Query for HTTP data fetching and mutations
- Kumo (`@cloudflare/kumo`) for UI components
- `chess.js` for legal move validation and game state
- Zod for request/response validation where helpful

## Documentation Findings

### Cloudflare Think

`@cloudflare/think` is the right base class for the agent. It handles the WebSocket chat protocol, message persistence, streaming, agent loop, stream resumption, client tools, and workspace tools.

The minimal server pattern is:

```ts
import { Think } from "@cloudflare/think";
import { routeAgentRequest } from "agents";
import { createWorkersAI } from "workers-ai-provider";

export class ChessAgent extends Think<Env> {
  getModel() {
    return createWorkersAI({ binding: this.env.AI })(
      "@cf/moonshotai/kimi-k2.5",
    );
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
```

For this app, Hono will handle `/api/*`, and `routeAgentRequest` will handle `/agents/*`.

### Agents Routing

- `routeAgentRequest(request, env)` routes `/agents/{agent-name}/{instance-name}` to the correct Durable Object instance.
- The agent class must be exported from the Worker entry point.
- The Wrangler `durable_objects.bindings[].class_name` must match the exported class name exactly.
- WebSocket responses from `routeAgentRequest` must be returned directly. Do not wrap them in a new `Response`.
- `getAgentByName(env.ChessAgent, gameId)` can be used from Hono routes to call agent methods for a specific game.

### Durable Object Configuration

Agents require Durable Objects. Since Think uses Durable Object SQLite-backed persistence, Wrangler needs both a binding and a migration:

```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "ChessAgent",
        "class_name": "ChessAgent"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["ChessAgent"]
    }
  ]
}
```

### React + Hono + Cloudflare Vite Plugin

Cloudflare's Hono + React SPA docs map closely to this app:

- `wrangler.jsonc.main` points to the Worker/Hono entry.
- `assets.not_found_handling` should be `single-page-application` for SPA routes.
- `vite.config.ts` includes `react()` and `cloudflare()`.
- The Cloudflare Vite plugin runs local development in the Workers runtime.

### Kumo

Use `@cloudflare/kumo`, not the unscoped `kumo` package.

For workshop simplicity, use standalone styles instead of adding Tailwind:

```ts
import "@cloudflare/kumo/styles/standalone";
```

Prefer granular imports for tree-shaking:

```tsx
import { Button } from "@cloudflare/kumo/components/button";
import { Surface } from "@cloudflare/kumo/components/surface";
```

## Architecture

```txt
Browser React app
  |
  | React Query over HTTP
  v
Hono API routes on Worker (/api/*)
  |
  | getAgentByName(env.ChessAgent, gameId)
  v
ChessAgent Durable Object
  |
  | chess.js validates and mutates chess state
  | Workers AI receives board context and legal moves, then acts through tools
  v
Persisted game state in Durable Object SQLite

Optional side panel:
Browser React app
  |
  | useAgent + useAgentChat over WebSocket
  v
ChessAgent Think chat (/agents/chess-agent/:gameId)
```

Core invariant:

```txt
The LLM suggests. chess.js decides.
```

The LLM should never be trusted to mutate game state directly. Every user move and every agent move must be validated by `chess.js` before being persisted.

## Dependencies

Runtime dependencies:

```txt
@cloudflare/ai-chat
@cloudflare/kumo
@cloudflare/shell
@cloudflare/think
@phosphor-icons/react
@tanstack/react-query
agents
ai
chess.js
echarts
hono
react
react-dom
workers-ai-provider
zod
```

Dev dependencies:

```txt
@cloudflare/vite-plugin
@cloudflare/vitest-pool-workers
@cloudflare/workers-types
@vitejs/plugin-react
typescript
vite
vitest
wrangler
```

## Project Structure

```txt
.
├── AGENTS.md
├── PLAN.md
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── wrangler.jsonc
└── src
    ├── client
    │   ├── App.tsx
    │   ├── main.tsx
    │   ├── styles.css
    │   ├── api
    │   │   ├── gameApi.ts
    │   │   └── queryKeys.ts
    │   ├── components
    │   │   ├── AgentPanel.tsx
    │   │   ├── Board.tsx
    │   │   ├── GameControls.tsx
    │   │   ├── GameStatus.tsx
    │   │   └── MoveHistory.tsx
    │   └── hooks
    │       └── useGame.ts
    ├── server
    │   ├── index.ts
    │   ├── env.ts
    │   └── routes
    │       └── games.ts
    ├── agents
    │   └── ChessAgent.ts
    └── shared
        ├── chess.ts
        ├── schemas.ts
        └── types.ts
```

## Server Plan

`src/server/index.ts` should stay small and show the routing boundary clearly:

```ts
import { routeAgentRequest } from "agents";
import { Hono } from "hono";
import { ChessAgent } from "../agents/ChessAgent";
import { gamesRouter } from "./routes/games";

export { ChessAgent };

const app = new Hono<{ Bindings: Env }>();

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
```

## API Plan

Initial HTTP API:

```txt
GET  /api/games/:gameId
POST /api/games/:gameId/moves
POST /api/games/:gameId/reset
```

Route responsibilities:

- Parse and validate request input.
- Resolve the game-specific agent with `getAgentByName(env.ChessAgent, gameId)`.
- Call a callable agent method.
- Return typed JSON responses consumed by React Query.

The API route should not implement chess logic. It is a thin HTTP boundary over the game agent.

## Agent Plan

`ChessAgent` owns the game state for one game instance.

Responsibilities:

- Store current FEN.
- Store SAN move history.
- Store the latest agent explanation.
- Store game status: active, checkmate, draw, stalemate, resignation if added later.
- Validate user moves with `chess.js`.
- Build an agent-turn prompt that includes the ASCII board, FEN, move history, status, and legal moves.
- Let Workers AI act through a small validated tool set.
- Validate every tool-driven move with `chess.js` before mutating durable state.
- Return tool failure responses to the model when a proposed move is invalid so it can retry.
- Return an explicit error if retries fail.

Do not add a deterministic fallback move in the initial version. We can add fallback behavior later if the workshop needs it.

Useful callable methods:

```ts
@callable()
getGame(): GameView

@callable()
playUserMove(input: PlayMoveInput): Promise<GameView>

@callable()
resetGame(): GameView
```

Agentic move selection flow:

```txt
1. User submits a move.
2. Agent validates and applies the user move with chess.js.
3. If the game is still active, agent builds an agent-turn prompt.
4. Prompt includes ASCII board, FEN, side to move, move history, status, and legal moves.
5. Agent calls tools to inspect state and play exactly one move.
6. `playMove` validates arguments and legality with chess.js before mutating state.
7. If `playMove` receives invalid input or an illegal move, it returns `{ ok: false, ... }` to the model.
8. Model can use the failure response and prompt-included legal moves to retry.
9. If retries fail, return an explicit error instead of mutating state.
10. If valid, persist the new game state and explanation.
```

Initial LLM tools:

```txt
inspectGameState
Read-only. Returns the current FEN, ASCII board, side to move, status, and move history.

playMove
Mutating. Attempts to make the agent's move. Validates input and legality before changing state.
```

Do not add a separate `listLegalMoves` tool initially. Legal moves should be included directly in the agent-turn prompt so the model has the candidate set before it acts. If `playMove` fails, it can still return the legal moves in the failure payload to help the model recover.

Tool result shape:

```ts
type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; legalMoves?: LegalMove[] };
```

Example agent-turn prompt shape:

```txt
You are playing black in a chess game against a human.

Current board:

8  r n b q k b n r
7  p p p p . p p p
6  . . . . . . . .
5  . . . . p . . .
4  . . . . P . . .
3  . . . . . . . .
2  P P P P . P P P
1  R N B Q K B N R
   a b c d e f g h

FEN: rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2
Move history: 1. e4 e5
Side to move: white
Legal moves: a2a3, a2a4, b1a3, b1c3, ...

Use the available tools to play exactly one move.
You must call playMove. Do not claim a move was played unless playMove returns ok: true.
If playMove returns ok: false, use the error and legal moves to choose another move.
```

## React Plan

React Query hooks:

```txt
useGame(gameId)
usePlayMove(gameId)
useResetGame(gameId)
```

Client components:

- `Board.tsx`: custom chessboard grid; owns only UI selection state.
- `GameStatus.tsx`: displays side to move, check, checkmate, draw, or errors.
- `MoveHistory.tsx`: displays SAN move list.
- `GameControls.tsx`: reset and game id controls.
- `AgentPanel.tsx`: optional Think chat panel using `useAgent` and `useAgentChat`.

The board should not implement chess legality. It can highlight selected squares and submit attempted moves, but the agent/API decides whether the move is valid.

### Board UI

Build the chessboard directly in React instead of adding a chessboard package. This keeps the workshop code transparent and avoids hiding the state/rendering model behind a library.

Board rendering plan:

- Render from server-provided game state.
- Use a custom CSS grid with 64 square buttons.
- Use Unicode chess symbols for pieces to avoid SVG/image assets.
- Keep board interaction simple: click source square, click target square, submit attempted move.
- Show square selection in the UI, but do not enforce chess legality in the browser.
- Handle promotion with a small UI control when needed, preferably defaulting the selected promotion to queen.
- Keep the board responsive with `width: min(92vw, 560px)` and `aspect-ratio: 1`.

Example piece mapping:

```ts
const pieceIcons = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};
```

Interaction flow:

```txt
1. User clicks e2.
2. Board stores selectedSquare = "e2".
3. User clicks e4.
4. Board calls playMove({ from: "e2", to: "e4" }).
5. React Query invalidates the game query.
6. Board re-renders from the persisted server/agent state.
```

Use Kumo for the shell around the board, not for the square grid itself:

- `Surface` for the board/card container.
- `Button` for controls.
- `Badge` for status.
- Custom CSS for board squares and pieces.

## Wrangler Plan

Expected `wrangler.jsonc` shape:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "chess-agent",
  "main": "src/server/index.ts",
  "compatibility_date": "2026-04-28",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*", "/agents/*"]
  },
  "durable_objects": {
    "bindings": [
      {
        "name": "ChessAgent",
        "class_name": "ChessAgent"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["ChessAgent"]
    }
  ],
  "ai": {
    "binding": "AI"
  },
  "observability": {
    "enabled": true
  }
}
```

## AGENTS.md Plan

`AGENTS.md` should be part of the bootstrap and should document:

- Purpose of the workshop app.
- Commands for dev, build, typecheck, test, and deploy.
- Project structure.
- Cloudflare routing model.
- Chess invariants.
- LLM boundaries.
- React Query conventions.
- Kumo usage conventions.
- Commenting style.

Important rules to include:

- Keep workshop code small and readable.
- Use `chess.js` as the source of truth for legal moves and status.
- Do not let the LLM directly mutate persisted game state.
- Prefer shared schemas/types from `src/shared`.
- Use React Query for HTTP server state.
- Use Kumo components via granular imports.
- Add comments only where they explain Cloudflare Agents, Durable Objects, Workers bindings, or non-obvious chess/LLM boundaries.

## Testing Plan

Initial verification commands:

```txt
npm run typecheck
npm test
npm run build
```

Useful tests:

- User legal move is accepted.
- User illegal move is rejected and does not mutate state.
- Agent move must be in the legal move list.
- Invalid model output triggers retry and eventually an error if retries fail.
- Reset returns the starting position.
- API routes return expected JSON shapes.

## Implementation Phases

1. Create package/config files for React, Vite, Workers, Wrangler, TypeScript, and Vitest.
2. Add Hono Worker entry and API route skeleton.
3. Add shared chess types, schemas, and helpers.
4. Implement `ChessAgent` with `chess.js` state handling and Workers AI move selection.
5. Add React Query API layer and hooks.
6. Build the Kumo-based UI.
7. Add optional Think chat/analysis panel.
8. Add `AGENTS.md`.
9. Run typecheck, tests, and build.
