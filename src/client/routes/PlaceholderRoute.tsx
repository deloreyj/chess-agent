import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";

import { RouteNav } from "./RouteNav";

type PlaceholderRouteProps = {
  active: "vanilla" | "lab";
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
};

export function PlaceholderRoute({
  active,
  eyebrow,
  title,
  description,
  bullets,
}: PlaceholderRouteProps) {
  return (
    <main className="app-shell placeholder-shell">
      <header className="app-header landing-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <RouteNav active={active} />
      </header>

      <LayerCard className="panel placeholder-panel">
        <Text variant="heading2">Coming next</Text>
        <Text variant="secondary">
          This route is reserved so the workshop can already present the full
          three-stage structure while implementation lands incrementally.
        </Text>
        <ul>
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        <a className="primary-link" href="/think">
          Open the Think implementation
        </a>
      </LayerCard>
    </main>
  );
}
