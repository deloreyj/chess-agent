import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { useState } from "react";

import type { ChessAgent } from "../../agents/ChessAgent";

type AgentPanelProps = {
  gameId: string;
};

export function AgentPanel({ gameId }: AgentPanelProps) {
  const [message, setMessage] = useState("");
  const agent = useAgent<ChessAgent>({ agent: "ChessAgent", name: gameId });
  const { messages, sendMessage, status } = useAgentChat({ agent });
  const isStreaming = status === "streaming" || status === "submitted";

  return (
    <LayerCard className="panel side-panel">
      <h2>Agent Chat</h2>
      <p className="muted">
        Optional Think chat connected to this game's agent instance.
      </p>

      <div className="chat-log">
        {messages.length === 0 ? <p className="muted">No chat messages.</p> : null}
        {messages.map((chatMessage) => (
          <div key={chatMessage.id} className={`chat-message ${chatMessage.role}`}>
            <strong>{chatMessage.role}</strong>
            {chatMessage.parts.map((part, index) =>
              part.type === "text" ? <p key={index}>{part.text}</p> : null,
            )}
          </div>
        ))}
      </div>

      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();

          if (!message.trim()) {
            return;
          }

          sendMessage({ text: message });
          setMessage("");
        }}
      >
        <Input
          aria-label="Message the agent"
          placeholder="Ask why it chose a move..."
          value={message}
          onChange={(event) => setMessage(event.currentTarget.value)}
        />
        <Button type="submit" loading={isStreaming} disabled={!message.trim()}>
          Send
        </Button>
      </form>
    </LayerCard>
  );
}
