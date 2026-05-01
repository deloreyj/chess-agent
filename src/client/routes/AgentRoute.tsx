import { Banner } from "@cloudflare/kumo/components/banner";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { useState } from "react";

import { Board } from "../components/Board";
import { GameControls } from "../components/GameControls";
import { GameStatus } from "../components/GameStatus";
import { useAgentChessGame } from "../hooks/useAgentChessGame";
import { RouteNav } from "./RouteNav";

const DEFAULT_GAME_ID = "agent-workshop-game";
type AgentGame = ReturnType<typeof useAgentChessGame>["game"];

export function AgentRoute() {
  const [gameId, setGameId] = useState(DEFAULT_GAME_ID);
  const { game, error, isPlayingMove, isResetting, playMove, resetGame } =
    useAgentChessGame(gameId);
  const isThinking = game?.agentThinking ?? false;
  const disableBoard = isPlayingMove || isThinking;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Stage 1 - Tool-Using Agent</h1>
          <p>
            Play white against a black Agent that owns its model call, prompt
            assembly, structured response, retries, and state updates directly.
          </p>
        </div>
        <div className="app-header-actions">
          <RouteNav active="agent" />
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
            <Text variant="secondary">Connecting to agent...</Text>
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

        <AgentSidePanel game={game} />
      </div>
    </main>
  );
}

function AgentSidePanel({ game }: { game: AgentGame }) {
  return (
    <LayerCard className="panel side-panel agent-stage-panel">
      <header className="agent-stage-panel-header">
        <Text variant="heading2">Manual Agent Loop</Text>
        <Text variant="secondary">
          This route keeps the moving parts visible: prompt, model response,
          retry, validate, persist, broadcast.
        </Text>
      </header>

      <section className="agent-loop-list" aria-label="Agent loop steps">
        {[
          "Build a prompt from FEN, board, history, and legal moves.",
          "Ask Workers AI for one structured move.",
          "Validate the requested move with chess.js.",
          "Retry invalid model output up to three times.",
          "Persist only the validated move with setState().",
        ].map((step, index) => (
          <div key={step} className="agent-loop-step">
            <span>{index + 1}</span>
            <Text>{step}</Text>
          </div>
        ))}
      </section>

      <section className="agent-explanation">
        <Text bold>Last agent explanation</Text>
        <Text variant="secondary">
          {game?.lastAgentExplanation ?? "Make a move to see why black replied."}
        </Text>
      </section>

      <section className="agent-history" aria-label="Move history">
        <Text bold>Move history</Text>
        {game && game.moves.length > 0 ? (
          <ol>
            {game.moves.map((move, index) => (
              <li key={`${move.uci}-${index}`}>
                <span>{index + 1}.</span>
                <strong>{move.color === "w" ? "White" : "Black"}</strong>
                <code>{move.san}</code>
              </li>
            ))}
          </ol>
        ) : (
          <Text variant="secondary">No moves yet.</Text>
        )}
      </section>
    </LayerCard>
  );
}
