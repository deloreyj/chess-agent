import { Banner } from "@cloudflare/kumo/components/banner";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { useState } from "react";

import { AgentPanel } from "../components/AgentPanel";
import { Board } from "../components/Board";
import { GameControls } from "../components/GameControls";
import { GameStatus } from "../components/GameStatus";
import { useHarnessChessGame } from "../hooks/useHarnessChessGame";
import { RouteNav } from "./RouteNav";

const DEFAULT_GAME_ID = "harness-workshop-game";

export function HarnessRoute() {
  const [gameId, setGameId] = useState(DEFAULT_GAME_ID);
  const {
    agent,
    game,
    error,
    isPlayingMove,
    isResetting,
    playMove,
    resetGame,
  } = useHarnessChessGame(gameId);
  const isThinking = game?.agentThinking ?? false;
  // Disable input while we're awaiting the player-move RPC OR the agent is
  // running its turn server-side (broadcast via state).
  const disableBoard = isPlayingMove || isThinking;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Stage 2 - Harnessed Agent</h1>
          <p>
            Play white against a black agent running inside the Think harness.
            Tool calls are visible in the chat transcript, while chess.js
            validates every move before state changes.
          </p>
        </div>
        <div className="app-header-actions">
          <RouteNav active="harness" />
          <GameControls
            gameId={gameId}
            isResetting={isResetting}
            onChangeGameId={setGameId}
            onReset={() => resetGame()}
          />
        </div>
      </header>

      <div className="game-layout">
        <LayerCard className="panel board-panel">
          {game ? null : (
            <Text variant="secondary">Connecting to harnessed agent...</Text>
          )}
          {error ? <Banner variant="error" description={error} /> : null}

          {game ? (
            <>
              <GameStatus game={game} isThinking={isThinking} />
              <Board
                game={game}
                disabled={disableBoard}
                onMove={(move) => playMove(move)}
              />
            </>
          ) : null}
        </LayerCard>

        <AgentPanel agent={agent} runtimeEvents={game?.runtimeEvents ?? []} />
      </div>
    </main>
  );
}
