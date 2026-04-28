import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `agents/vite` runs the `@callable()` decorators through Babel so the dev
// runner can parse the Worker entry. Without it, the Cloudflare Vite plugin's
// runner-worker chokes on TC39 decorator syntax in `ChessAgent.ts`.
import agents from "agents/vite";

export default defineConfig({
  plugins: [agents(), react(), cloudflare()],
});
