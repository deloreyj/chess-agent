import { Badge } from "@cloudflare/kumo/components/badge";
import { Text } from "@cloudflare/kumo/components/text";

import type { GameView } from "../../shared/types";

type GameStatusProps = {
  game: GameView;
  isBusy: boolean;
};

export function GameStatus({ game, isBusy }: GameStatusProps) {
  return (
    <div className="status-row">
      <Badge variant={statusVariant(game.status)}>{game.status}</Badge>
      <Text>{game.turn === "w" ? "White" : "Black"} to move</Text>
      {isBusy ? <Text variant="secondary">Agent thinking...</Text> : null}
      {game.lastAgentExplanation ? (
        <div className="agent-note">
          <Text variant="secondary">Agent: {game.lastAgentExplanation}</Text>
        </div>
      ) : null}
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
