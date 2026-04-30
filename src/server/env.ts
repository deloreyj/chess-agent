import type { ThinkChessAgent } from "../agents/ThinkChessAgent";

export type Env = {
  AI: Ai;
  ThinkChessAgent: DurableObjectNamespace<ThinkChessAgent>;
};
