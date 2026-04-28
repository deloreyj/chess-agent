import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { useState } from "react";

import { useGame, usePlayMove, useResetGame } from "./hooks/useGame";
import { AgentPanel } from "./components/AgentPanel";
import { Board } from "./components/Board";
import { GameControls } from "./components/GameControls";
import { GameStatus } from "./components/GameStatus";
import { MoveHistory } from "./components/MoveHistory";

const DEFAULT_GAME_ID = "workshop-game";

export function App() {
  const [gameId, setGameId] = useState(DEFAULT_GAME_ID);
  const game = useGame(gameId);
  const playMove = usePlayMove(gameId);
  const resetGame = useResetGame(gameId);
  const isBusy = playMove.isPending || resetGame.isPending;

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Cloudflare Agents Day</p>
        <h1>Chess Agent</h1>
        <p>
          Play white against a black agent. The model can request moves through
          tools, but chess.js validates before the Durable Object state changes.
        </p>
      </section>

      <div className="game-layout">
        <LayerCard className="panel board-panel">
          <GameControls
            gameId={gameId}
            isResetting={resetGame.isPending}
            onChangeGameId={setGameId}
            onReset={() => resetGame.mutate()}
          />

          {game.isLoading ? <p>Loading game...</p> : null}
          {game.error ? <p className="error-text">{game.error.message}</p> : null}

          {game.data ? (
            <>
              <GameStatus game={game.data} isBusy={isBusy} />
              <Board
                game={game.data}
                disabled={isBusy}
                onMove={(move) => playMove.mutate(move)}
              />
              {playMove.error ? (
                <p className="error-text">{playMove.error.message}</p>
              ) : null}
            </>
          ) : null}
        </LayerCard>

        <div className="side-panels">
          {game.data ? <MoveHistory moves={game.data.moves} /> : null}
          <AgentPanel gameId={gameId} />
        </div>
      </div>
    </main>
  );
}
