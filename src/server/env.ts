import type { ChessAgent } from "../agents/ChessAgent";

export type Env = {
  AI: Ai;
  ChessAgent: DurableObjectNamespace<ChessAgent>;
};
