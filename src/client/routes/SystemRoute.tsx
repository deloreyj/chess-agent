import { Banner } from "@cloudflare/kumo/components/banner";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { GearSixIcon } from "@phosphor-icons/react";
import { useState } from "react";

import type { SystemState } from "../../shared/types";
import { AgentPanel } from "../components/AgentPanel";
import { Board } from "../components/Board";
import { GameControls } from "../components/GameControls";
import { GameStatus } from "../components/GameStatus";
import { useChessSystem } from "../hooks/useChessSystem";
import { RouteNav } from "./RouteNav";

const DEFAULT_SYSTEM_ID = "system-workshop-game";
type SystemPanelView = "board" | "control-room";
type ChatTarget = "director" | "player";
const CHAT_TARGETS: readonly ChatTarget[] = ["director", "player"];

export function SystemRoute() {
  const [systemId, setSystemId] = useState(DEFAULT_SYSTEM_ID);
  const [panelView, setPanelView] = useState<SystemPanelView>("board");
  const [chatTarget, setChatTarget] = useState<ChatTarget>("director");
  const {
    agent: directorAgent,
    playerAgent,
    system,
    game,
    error,
    isPlayingMove,
    isResetting,
    playMove,
    resetSystem,
    refreshSystem,
  } = useChessSystem(systemId);
  const playerThinking = game?.agentThinking ?? false;
  const disableBoard = isPlayingMove || playerThinking;
  const showingControlRoom = panelView === "control-room";
  const personaKey = system
    ? `${system.persona.name}:${system.persona.style}:${system.persona.instructions}`
    : "initial";
  const chatTargetToggle = (
    <ChatTargetToggle target={chatTarget} onChangeTarget={setChatTarget} />
  );

  return (
    <main className="app-shell system-shell">
      <header className="app-header">
        <div>
          <h1>Stage 3 - Agentic System</h1>
          <p>
            The director agent coordinates a specialized player sub-agent,
            strategy memory, persona changes, and safe board-theme updates.
          </p>
        </div>
        <div className="app-header-actions">
          <RouteNav active="system" />
          <GameControls
            gameId={systemId}
            isResetting={isResetting}
            onChangeGameId={setSystemId}
            onReset={() => resetSystem()}
          />
        </div>
      </header>

      <div className="game-layout system-layout">
        <LayerCard className="panel board-panel system-game-panel">
          <div className="board-panel-header">
            {game ? (
              <GameStatus game={game} isThinking={playerThinking} />
            ) : (
              <Text variant="secondary">Connecting to system...</Text>
            )}
            {system ? (
              <button
                type="button"
                className="system-panel-toggle"
                aria-label={
                  showingControlRoom ? "Show chess board" : "Show control room"
                }
                aria-pressed={showingControlRoom}
                title={
                  showingControlRoom ? "Show chess board" : "Show control room"
                }
                onClick={() =>
                  setPanelView(showingControlRoom ? "board" : "control-room")
                }
              >
                <GearSixIcon size={18} weight="bold" />
              </button>
            ) : null}
          </div>
          {error ? <Banner variant="error" description={error} /> : null}

          {showingControlRoom && system ? (
            <SystemControlRoom system={system} />
          ) : game ? (
            <Board
              game={game}
              disabled={disableBoard}
              theme={system?.boardTheme}
              onMove={(move) => playMove(move)}
            />
          ) : null}
        </LayerCard>

        {chatTarget === "director" ? (
          <AgentPanel
            key="director"
            agent={directorAgent}
            title="Director Chat"
            description="Ask the director to coordinate the player, update memory, or change the board theme."
            headerAccessory={chatTargetToggle}
            placeholder="Ask the director to update memory, theme, or player style..."
            showRuntimeTimeline={false}
            onResponseComplete={refreshSystem}
            emptyTitle="Try a system command."
            emptyDescription="For example: make this feel like a neon blitz arena and make the chess player more aggressive."
          />
        ) : (
          <AgentPanel
            key={`player:${personaKey}`}
            agent={playerAgent}
            title={`${system?.persona.name ?? "Player"} Chat`}
            description={`Talk directly with the player sub-agent to experience its ${system?.persona.style ?? "current"} persona.`}
            headerAccessory={chatTargetToggle}
            placeholder="Chat with the chess player persona..."
            showRuntimeTimeline={false}
            emptyTitle="Meet the player persona."
            emptyDescription="Ask how it sees the position, what it values, or how its current style changes its choices."
          />
        )}
      </div>
    </main>
  );
}

type ChatTargetToggleProps = {
  target: ChatTarget;
  onChangeTarget: (target: ChatTarget) => void;
};

function ChatTargetToggle({ target, onChangeTarget }: ChatTargetToggleProps) {
  return (
    <div className="chat-target-toggle" aria-label="Chat target">
      {CHAT_TARGETS.map((nextTarget) => (
        <button
          key={nextTarget}
          type="button"
          aria-pressed={target === nextTarget}
          onClick={() => onChangeTarget(nextTarget)}
        >
          {nextTarget === "director" ? "Director" : "Player"}
        </button>
      ))}
    </div>
  );
}

type SystemControlRoomProps = {
  system: SystemState;
};

function SystemControlRoom({ system }: SystemControlRoomProps) {
  return (
    <div className="system-control-room">
      <section>
        <Text variant="heading2">Control Room</Text>
        <Text variant="secondary">
          Director state is mirrored here; chess state still lives in the player
          sub-agent.
        </Text>
      </section>

      <section className="system-state-grid" aria-label="System state">
        <div>
          <Text bold>Persona</Text>
          <Text variant="secondary">
            {system.persona.name} · {system.persona.style}
          </Text>
        </div>
        <div>
          <Text bold>Theme</Text>
          <Text variant="secondary">{system.boardTheme.name}</Text>
        </div>
      </section>

      <section className="system-memory-list" aria-label="Strategy memory">
        <Text bold>Strategy Memory</Text>
        {system.strategyNotes.length > 0 ? (
          <ul>
            {system.strategyNotes.map((note, index) => (
              <li key={`${note}-${index}`}>{note}</li>
            ))}
          </ul>
        ) : (
          <Text variant="secondary">No strategy notes yet.</Text>
        )}
      </section>

      <section className="system-memory-list" aria-label="Player trends">
        <Text bold>Player Trends</Text>
        {system.playerTrends.length > 0 ? (
          <ul>
            {system.playerTrends.map((trend, index) => (
              <li key={`${trend}-${index}`}>{trend}</li>
            ))}
          </ul>
        ) : (
          <Text variant="secondary">No player trends yet.</Text>
        )}
      </section>

      <section className="system-action-log" aria-label="Director action log">
        <Text bold>Runtime Action Log</Text>
        {system.recentDirectorActions.length > 0 ? (
          <ol>
            {system.recentDirectorActions.map((action) => (
              <li key={action.id}>
                <time dateTime={new Date(action.at).toISOString()}>
                  {formatActionTime(action.at)}
                </time>
                <span>{action.label}</span>
                {action.detail ? <em>{action.detail}</em> : null}
              </li>
            ))}
          </ol>
        ) : (
          <Text variant="secondary">No director actions yet.</Text>
        )}
      </section>
    </div>
  );
}

function formatActionTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
