import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";

import type { MoveView } from "../../shared/types";

type MoveHistoryProps = {
  moves: MoveView[];
};

export function MoveHistory({ moves }: MoveHistoryProps) {
  return (
    <LayerCard className="panel side-panel">
      <Text variant="heading2">Move History</Text>
      {moves.length === 0 ? (
        <Text variant="secondary">No moves yet.</Text>
      ) : (
        <ol className="move-list">
          {moves.map((move, index) => (
            <li key={`${move.uci}-${index}`}>
              <Text variant="secondary">
                {Math.floor(index / 2) + 1}
                {move.color === "w" ? "." : "..."}
              </Text>
              <Text bold>{move.san}</Text>
              <Text variant="mono-secondary">{move.uci}</Text>
            </li>
          ))}
        </ol>
      )}
    </LayerCard>
  );
}
