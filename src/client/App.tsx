import { LandingRoute } from "./routes/LandingRoute";
import { PlaceholderRoute } from "./routes/PlaceholderRoute";
import { ThinkRoute } from "./routes/ThinkRoute";

export function App() {
  const route = getRoute(window.location.pathname);

  if (route === "think") {
    return <ThinkRoute />;
  }

  if (route === "vanilla") {
    return (
      <PlaceholderRoute
        active="vanilla"
        eyebrow="Stage 1 · /vanilla"
        title="Vanilla LLM Chess"
        description="The baseline demo will show the app owning the model call, prompt assembly, tool loop, retries, and state updates."
        bullets={[
          "Durable Object Agent owns one chess game.",
          "@callable() exposes gameplay RPC over WebSocket.",
          "chess.js validates every move before state changes.",
          "The app owns the LLM orchestration glue.",
        ]}
      />
    );
  }

  if (route === "lab") {
    return (
      <PlaceholderRoute
        active="lab"
        eyebrow="Stage 3 · /lab"
        title="Chess Lab"
        description="The north-star demo will turn the chess game into an agent system with a director, a player sub-agent, memory, reflection, and safe runtime customization."
        bullets={[
          "ChessDirectorAgent coordinates the lab experience.",
          "ChessPlayerAgent owns authoritative chess state.",
          "Memory captures player trends and strategy notes.",
          "Safe tools update persona and board theme.",
        ]}
      />
    );
  }

  return <LandingRoute />;
}

function getRoute(pathname: string) {
  const route = pathname.replace(/\/+$/, "") || "/";

  if (route === "/think") {
    return "think";
  }

  if (route === "/vanilla") {
    return "vanilla";
  }

  if (route === "/lab") {
    return "lab";
  }

  return "landing";
}
