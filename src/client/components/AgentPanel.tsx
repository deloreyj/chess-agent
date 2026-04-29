import { useAgentChat } from "@cloudflare/ai-chat/react";
import {
  ArrowUpIcon,
  BrainIcon,
  CaretDownIcon,
  StopIcon,
} from "@phosphor-icons/react";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

import type { ChessAgent } from "../../agents/ChessAgent";
import type { GameState } from "../../shared/types";

// Shape returned by useAgent<ChessAgent, GameState>. We only need the props
// useAgentChat consumes, so type it loosely to avoid pulling in PartySocket.
type ChessAgentClient = ReturnType<
  typeof import("agents/react").useAgent<ChessAgent, GameState>
>;

type AgentPanelProps = {
  /**
   * The agent connection from useAgent in the parent. Sharing it means
   * gameplay state sync and chat ride the same WebSocket instead of opening
   * a second connection to the same Durable Object.
   */
  agent: ChessAgentClient;
};

type MessagePart = {
  type?: string;
  text?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  state?: string;
  toolCallId?: string;
  [key: string]: unknown;
};

export function AgentPanel({ agent }: AgentPanelProps) {
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
              <MessageParts parts={chatMessage.parts as MessagePart[]} />
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

function isInternalTurnPrompt(message: { role: string; parts: unknown[] }) {
  if (message.role !== "user") {
    return false;
  }

  const text = message.parts
    .map((part) =>
      typeof part === "object" &&
      part !== null &&
      "type" in part &&
      (part as MessagePart).type === "text"
        ? (part as MessagePart).text
        : undefined,
    )
    .filter(Boolean)
    .join("\n");

  return (
    text.includes("You are playing black in a chess game against a human.") &&
    text.includes("Legal moves:") &&
    text.includes("You must call playMove")
  );
}

function MessageParts({ parts }: { parts: MessagePart[] }) {
  const visibleParts = useMemo(
    () => parts.filter((part) => part.type !== "step-start"),
    [parts],
  );

  return (
    <div className="agent-message-parts">
      {visibleParts.map((part, index) => (
        <MessagePartView key={`${part.type ?? "part"}-${index}`} part={part} />
      ))}
    </div>
  );
}

function MessagePartView({ part }: { part: MessagePart }) {
  const type = part.type ?? "unknown";

  if (type === "text") {
    return <TextBlock text={part.text ?? ""} />;
  }

  if (type === "reasoning") {
    return (
      <ThinkingDisclosure
        title="Reasoning"
        summary="Model reasoning"
        body={part.text ?? formatValue(part)}
      />
    );
  }

  if (
    type.startsWith("tool-") ||
    type === "tool-call" ||
    type === "tool-result"
  ) {
    return <ToolDisclosure part={part} />;
  }

  return (
    <ThinkingDisclosure
      title={humanizePartType(type)}
      summary="Message event"
      body={formatValue(part)}
    />
  );
}

function TextBlock({ text }: { text: string }) {
  if (!text.trim()) {
    return null;
  }

  return (
    <div className="agent-text-block">
      {text.split(/\n{2,}/).map((paragraph, index) => (
        <p key={index}>{renderInlineMarkdown(paragraph)}</p>
      ))}
    </div>
  );
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

function ToolDisclosure({ part }: { part: MessagePart }) {
  const toolName = getToolName(part);
  const state = typeof part.state === "string" ? part.state : undefined;
  const summary = state ? humanizePartType(state) : "Tool call";
  const details = [
    part.input !== undefined ? `Input\n${formatValue(part.input)}` : undefined,
    part.output !== undefined
      ? `Output\n${formatValue(part.output)}`
      : undefined,
    part.errorText ? `Error\n${part.errorText}` : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <ThinkingDisclosure
      title={toolName}
      summary={summary}
      body={details || formatValue(part)}
    />
  );
}

function ThinkingDisclosure({
  title,
  summary,
  body,
}: {
  title: string;
  summary: string;
  body: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="agent-thinking-block">
      <button
        type="button"
        className="agent-thinking-trigger"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <CaretDownIcon size={12} weight="bold" />
        <span>{expanded ? "hide thinking" : "see thinking"}</span>
        <span className="agent-thinking-summary">
          {title} · {summary}
        </span>
      </button>
      {expanded ? <pre className="agent-thinking-body">{body}</pre> : null}
    </div>
  );
}

function getToolName(part: MessagePart) {
  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return humanizePartType(part.type.replace(/^tool-/, ""));
  }

  if (typeof part.toolName === "string") {
    return humanizePartType(part.toolName);
  }

  return "Tool call";
}

function humanizePartType(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}
