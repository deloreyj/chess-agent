import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";

import { RouteNav } from "./RouteNav";

const stages = [
  {
    href: "/vanilla",
    eyebrow: "Stage 1",
    title: "Vanilla LLM Chess",
    summary: "The app owns the model call, loop, retries, and state updates.",
    status: "Available now",
  },
  {
    href: "/think",
    eyebrow: "Stage 2",
    title: "Think Chess Agent",
    summary: "Think owns the loop while the app keeps chess rules and tools.",
    status: "Available now",
  },
  {
    href: "/lab",
    eyebrow: "Stage 3",
    title: "Chess Lab",
    summary: "A director agent coordinates a player agent, memory, and safe changes.",
    status: "Planned",
  },
] as const;

export function LandingRoute() {
  return (
    <main className="app-shell landing-shell">
      <header className="app-header landing-header">
        <div>
          <p className="eyebrow">Cloudflare Agents Day</p>
          <h1>From LLM App To Agent System</h1>
          <p>
            One chess domain, three architectures. The demo starts with custom
            orchestration, moves to Think as the agent harness, then expands
            into a coordinated multi-agent lab.
          </p>
        </div>
        <RouteNav active="landing" />
      </header>

      <section className="stage-grid" aria-label="Demo stages">
        {stages.map((stage) => (
          <a key={stage.href} className="stage-card-link" href={stage.href}>
            <LayerCard className="panel stage-card">
              <div className="stage-card-topline">
                <span>{stage.eyebrow}</span>
                <span>{stage.status}</span>
              </div>
              <Text variant="heading2">{stage.title}</Text>
              <Text variant="secondary">{stage.summary}</Text>
            </LayerCard>
          </a>
        ))}
      </section>

      <LayerCard className="panel narrative-panel">
        <Text variant="heading2">Workshop thesis</Text>
        <p>
          A useful agent is not a clever prompt. It is a model inside a loop,
          connected to useful tools, grounded in durable state, and constrained
          by hard boundaries.
        </p>
        <div className="refrain-grid">
          <div>
            <Text bold>The model suggests.</Text>
            <Text variant="secondary">Deterministic code decides.</Text>
          </div>
          <div>
            <Text bold>Agents SDK gives the body.</Text>
            <Text variant="secondary">Think gives the loop.</Text>
          </div>
          <div>
            <Text bold>The question changes.</Text>
            <Text variant="secondary">
              From “how do I call the model?” to “what can it safely do?”
            </Text>
          </div>
        </div>
      </LayerCard>
    </main>
  );
}
