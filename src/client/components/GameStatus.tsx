import { Badge } from "@cloudflare/kumo/components/badge";

import type { GameView } from "../../shared/types";

type GameStatusProps = {
  game: GameView;
  isBusy: boolean;
};

export function GameStatus({ game, isBusy }: GameStatusProps) {
  return (
    <div className="status-row">
      <Badge variant={statusVariant(game.status)}>{game.status}</Badge>
      <span>{game.turn === "w" ? "White" : "Black"} to move</span>
      {isBusy ? <span className="thinking">Agent thinking...</span> : null}
      {game.lastAgentExplanation ? (
        <p className="agent-note">Agent: {game.lastAgentExplanation}</p>
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
