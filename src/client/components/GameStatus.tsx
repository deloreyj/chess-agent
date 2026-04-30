import { Badge } from "@cloudflare/kumo/components/badge";
import { Text } from "@cloudflare/kumo/components/text";

import type { GameView } from "../../shared/types";

type GameStatusProps = {
  game: GameView;
  /**
   * True when the LLM is in the middle of its turn (broadcast via agent
   * state, not derived from a local pending mutation).
   */
  isThinking: boolean;
};

export function GameStatus({ game, isThinking }: GameStatusProps) {
  return (
    <div className="status-row">
      <Badge variant={statusVariant(game.status)}>{game.status}</Badge>
      <Text>{game.turn === "w" ? "White" : "Black"} to move</Text>
      {isThinking ? <Text variant="secondary">Agent thinking...</Text> : null}
    </div>
  );
}

function statusVariant(status: GameView["status"]) {
  if (status === "active") {
    return "success";
  }

  if (status === "check") {
    return "warning";
  }

  return "info";
}
