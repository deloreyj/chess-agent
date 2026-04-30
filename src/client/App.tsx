import { LandingRoute } from "./routes/LandingRoute";
import { PlaceholderRoute } from "./routes/PlaceholderRoute";
import { ThinkRoute } from "./routes/ThinkRoute";
import { VanillaRoute } from "./routes/VanillaRoute";

export function App() {
  const route = getRoute(window.location.pathname);

  if (route === "think") {
    return <ThinkRoute />;
  }

  if (route === "vanilla") {
    return <VanillaRoute />;
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
