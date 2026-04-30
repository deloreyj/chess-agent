import { useAgentChat } from "@cloudflare/ai-chat/react";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { ArrowUpIcon, BrainIcon, StopIcon } from "@phosphor-icons/react";
import type { UIMessage } from "ai";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

import type { ThinkChessAgent } from "../../agents/ThinkChessAgent";
import { isInternalTurnMessageId } from "../../shared/messages";
import type { GameState, RuntimeEvent } from "../../shared/types";
import { MessageParts } from "./MessageParts";

// Shape returned by useAgent<ThinkChessAgent, GameState>. We only need the props
// useAgentChat consumes, so type it loosely to avoid pulling in PartySocket.
type ThinkChessAgentClient = ReturnType<
  typeof import("agents/react").useAgent<ThinkChessAgent, GameState>
>;

type AgentPanelProps = {
  /**
   * The agent connection from useAgent in the parent. Sharing it means
   * gameplay state sync and chat ride the same WebSocket instead of opening
   * a second connection to the same Durable Object.
   */
  agent: ThinkChessAgentClient;
  runtimeEvents: RuntimeEvent[];
};

export function AgentPanel({ agent, runtimeEvents }: AgentPanelProps) {
  const [message, setMessage] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, stop } = useAgentChat({ agent });
  const isStreaming = status === "streaming" || status === "submitted";
  const visibleMessages = useMemo(
    () => messages.filter((chatMessage) => !isInternalTurnPrompt(chatMessage)),
    [messages],
  );

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) {
      return;
    }

    feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
  }, [visibleMessages, status]);

  return (
    <LayerCard className="panel side-panel agent-chat-shell">
      <header className="agent-chat-header">
        <div>
          <Text variant="heading2">Agent Chat</Text>
          <Text variant="secondary">
            Watch the model reason, call tools, and explain its moves.
          </Text>
        </div>
        <div
          className="agent-chat-status"
          data-active={isStreaming ? "true" : "false"}
        >
          {isStreaming ? "Thinking" : "Ready"}
        </div>
      </header>

      <section className="runtime-timeline" aria-label="Think runtime timeline">
        <div className="runtime-timeline-header">
          <Text bold>Think Runtime</Text>
          <Text variant="secondary">Loop events</Text>
        </div>
        {runtimeEvents.length === 0 ? (
          <Text variant="secondary">Make a move to watch the harness run.</Text>
        ) : (
          <ol>
            {runtimeEvents.map((event) => (
              <li key={event.id}>
                <time>{formatRuntimeTime(event.at)}</time>
                <span>{event.label}</span>
                {event.detail ? <em>{event.detail}</em> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div ref={feedRef} className="agent-chat-feed" aria-live="polite">
        {visibleMessages.length === 0 ? (
          <div className="agent-chat-empty">
            <BrainIcon size={28} />
            <Text bold>Ask about the position.</Text>
            <Text variant="secondary">
              The transcript will show text, reasoning parts, and tool calls
              from the chess agent.
            </Text>
          </div>
        ) : null}

        {visibleMessages.map((chatMessage) => (
          <article
            key={chatMessage.id}
            className="agent-message"
            data-role={chatMessage.role}
          >
            <div className="agent-message-bubble">
              <MessageParts parts={chatMessage.parts} />
            </div>
          </article>
        ))}

        {isStreaming ? (
          <div className="agent-streaming-indicator" role="status">
            <BrainIcon size={16} />
            <span>Thinking...</span>
          </div>
        ) : null}
      </div>

      <form
        className="agent-chat-composer"
        onSubmit={(event) => {
          event.preventDefault();

          if (isStreaming) {
            stop?.();
            return;
          }

          if (!message.trim()) {
            return;
          }

          sendMessage({ text: message });
          setMessage("");
        }}
      >
        <textarea
          aria-label="Message the agent"
          placeholder="Ask why it chose a move..."
          rows={3}
          value={message}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
            setMessage(event.currentTarget.value)
          }
          onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="agent-chat-composer-footer">
          <Text variant="secondary">Enter sends. Shift+Enter adds a line.</Text>
          <Button
            type="submit"
            variant="primary"
            shape="circle"
            disabled={isStreaming ? false : !message.trim()}
            aria-label={isStreaming ? "Stop response" : "Send message"}
          >
            {isStreaming ? (
              <StopIcon weight="fill" />
            ) : (
              <ArrowUpIcon weight="bold" />
            )}
          </Button>
        </div>
      </form>
    </LayerCard>
  );
}

function isInternalTurnPrompt(message: UIMessage) {
  return message.role === "user" && isInternalTurnMessageId(message.id);
}

function formatRuntimeTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
