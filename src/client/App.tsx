import { AgentRoute } from "./routes/AgentRoute";
import { HarnessRoute } from "./routes/HarnessRoute";
import { LandingRoute } from "./routes/LandingRoute";
import { SystemRoute } from "./routes/SystemRoute";

export function App() {
  const route = getRoute(window.location.pathname);

  if (route === "harness") {
    return <HarnessRoute />;
  }

  if (route === "agent") {
    return <AgentRoute />;
  }

  if (route === "system") {
    return <SystemRoute />;
  }

  return <LandingRoute />;
}

function getRoute(pathname: string) {
  const route = pathname.replace(/\/+$/, "") || "/";

  if (route === "/harness") {
    return "harness";
  }

  if (route === "/agent") {
    return "agent";
  }

  if (route === "/system") {
    return "system";
  }

  return "landing";
}
