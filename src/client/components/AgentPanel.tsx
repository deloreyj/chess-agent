import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
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
      <Text variant="heading2">Agent Chat</Text>
      <Text variant="secondary">
        Optional Think chat connected to this game's agent instance.
      </Text>

      <div className="chat-log">
        {messages.length === 0 ? (
          <Text variant="secondary">No chat messages.</Text>
        ) : null}
        {messages.map((chatMessage) => (
          <LayerCard key={chatMessage.id} className="chat-message">
            <Text variant="heading3">{chatMessage.role}</Text>
            {chatMessage.parts.map((part, index) =>
              part.type === "text" ? <Text key={index}>{part.text}</Text> : null,
            )}
          </LayerCard>
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
