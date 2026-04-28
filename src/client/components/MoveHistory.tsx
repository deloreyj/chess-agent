import { LayerCard } from "@cloudflare/kumo/components/layer-card";

import type { MoveView } from "../../shared/types";

type MoveHistoryProps = {
  moves: MoveView[];
};

export function MoveHistory({ moves }: MoveHistoryProps) {
  return (
    <LayerCard className="panel side-panel">
      <h2>Move History</h2>
      {moves.length === 0 ? (
        <p className="muted">No moves yet.</p>
      ) : (
        <ol className="move-list">
          {moves.map((move, index) => (
            <li key={`${move.uci}-${index}`}>
              <span>{Math.floor(index / 2) + 1}{move.color === "w" ? "." : "..."}</span>
              <strong>{move.san}</strong>
              <code>{move.uci}</code>
            </li>
          ))}
        </ol>
      )}
    </LayerCard>
  );
}
