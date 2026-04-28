import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { useState } from "react";

type GameControlsProps = {
  gameId: string;
  isResetting: boolean;
  onChangeGameId: (gameId: string) => void;
  onReset: () => void;
};

export function GameControls({
  gameId,
  isResetting,
  onChangeGameId,
  onReset,
}: GameControlsProps) {
  const [draftGameId, setDraftGameId] = useState(gameId);

  return (
    <div className="game-controls">
      <Input
        label="Game ID"
        value={draftGameId}
        onChange={(event) => setDraftGameId(event.currentTarget.value)}
      />
      <Button
        type="button"
        variant="primary"
        onClick={() => onChangeGameId(draftGameId.trim() || gameId)}
      >
        Load
      </Button>
      <Button type="button" loading={isResetting} onClick={onReset}>
        Reset
      </Button>
    </div>
  );
}
