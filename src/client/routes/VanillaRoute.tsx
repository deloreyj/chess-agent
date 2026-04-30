import { Banner } from "@cloudflare/kumo/components/banner";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { useState } from "react";

import { Board } from "../components/Board";
import { GameControls } from "../components/GameControls";
import { GameStatus } from "../components/GameStatus";
import { useVanillaChessGame } from "../hooks/useVanillaChessGame";
import { RouteNav } from "./RouteNav";

const DEFAULT_GAME_ID = "vanilla-workshop-game";
type VanillaGame = ReturnType<typeof useVanillaChessGame>["game"];

export function VanillaRoute() {
  const [gameId, setGameId] = useState(DEFAULT_GAME_ID);
  const { game, error, isPlayingMove, isResetting, playMove, resetGame } =
    useVanillaChessGame(gameId);
  const isThinking = game?.agentThinking ?? false;
  const disableBoard = isPlayingMove || isThinking;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Stage 1 · /vanilla</p>
          <h1>Vanilla LLM Chess</h1>
          <p>
            Play white against a black Agent that owns its model call, prompt
            assembly, structured response, retries, and state updates directly.
          </p>
          <RouteNav active="vanilla" />
        </div>
        <GameControls
          gameId={gameId}
          isResetting={isResetting}
          onChangeGameId={setGameId}
          onReset={() => resetGame()}
        />
      </header>

      <div className="game-layout">
        <LayerCard className="panel board-panel">
          {game ? null : (
            <Text variant="secondary">Connecting to vanilla agent...</Text>
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

        <VanillaSidePanel game={game} />
      </div>
    </main>
  );
}

function VanillaSidePanel({ game }: { game: VanillaGame }) {
  return (
    <LayerCard className="panel side-panel vanilla-panel">
      <header className="vanilla-panel-header">
        <Text variant="heading2">Manual Agent Loop</Text>
        <Text variant="secondary">
          This route keeps the moving parts visible: prompt, model response,
          retry, validate, persist, broadcast.
        </Text>
      </header>

      <section className="vanilla-loop-list" aria-label="Vanilla loop steps">
        {[
          "Build a prompt from FEN, board, history, and legal moves.",
          "Ask Workers AI for one structured move.",
          "Validate the requested move with chess.js.",
          "Retry invalid model output up to three times.",
          "Persist only the validated move with setState().",
        ].map((step, index) => (
          <div key={step} className="vanilla-loop-step">
            <span>{index + 1}</span>
            <Text>{step}</Text>
          </div>
        ))}
      </section>

      <section className="vanilla-explanation">
        <Text bold>Last agent explanation</Text>
        <Text variant="secondary">
          {game?.lastAgentExplanation ?? "Make a move to see why black replied."}
        </Text>
      </section>

      <section className="vanilla-history" aria-label="Move history">
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
