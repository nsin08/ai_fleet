/**
 * OpsEdge AI — LangGraph ReAct Agent
 *
 * Uses LangGraph's prebuilt createReactAgent with fleet data tools.
 * Model is injected from the ai-provider factory (Ollama / OpenAI / Claude).
 * Agent maintains message state and can call tools in multiple rounds before answering.
 */

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createAiModel } from '../../config/ai-provider.js';
import { allFleetTools } from './tools/index.js';

/* ── System Prompt ────────────────────────────────────────────────────────── */
const SYSTEM_PROMPT = `You are OpsEdge AI, the intelligent fleet operations assistant for FleetEdge.

You have access to live fleet data tools. ALWAYS call the appropriate tool to fetch real data before answering questions about drivers, alerts, vehicles, or fleet status. Never invent names, IDs, scores, or metrics.

Guidelines:
- Use tools to get real data, then answer based ONLY on that data.
- If a question is ambiguous (e.g. "top driver" — which depot?), make a reasonable assumption and state it, OR ask one clarifying question.
- Be concise and operational. Operators need fast, actionable answers.
- Reference real IDs and names from tool results in your response.
- If data shows no issues, say so clearly. Do not fabricate concerns.
- Format numbers cleanly (e.g. "score: 87", "42 km/h", "14 open alerts").

You are running on a fleet platform. Available modules: Vehicles, Drivers, Alerts, Dispatch, Fuel, Maintenance, Costs.`;

/* ── Agent singleton (lazily initialised) ────────────────────────────────── */
let _model: BaseChatModel | null = null;
let _agent: ReturnType<typeof createReactAgent> | null = null;

function getModel(): BaseChatModel {
  if (!_model) {
    _model = createAiModel();
  }
  return _model;
}

function getAgent(): ReturnType<typeof createReactAgent> {
  if (!_agent) {
    _agent = createReactAgent({
      llm: getModel(),
      tools: allFleetTools,
    });
  }
  return _agent;
}

/* ── Public chat function ─────────────────────────────────────────────────── */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentChatResult {
  reply: string;
  model: string;
}

export async function runOpsEdgeChat(
  message: string,
  history: ChatMessage[] = [],
): Promise<AgentChatResult> {
  const agent = getAgent();

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    ...history.map((h) =>
      h.role === 'user'
        ? new HumanMessage(h.content)
        : new SystemMessage(`Assistant previously said: ${h.content}`),
    ),
    new HumanMessage(message),
  ];

  const result = await agent.invoke(
    { messages },
    { recursionLimit: 12 },
  );

  const lastMessage = result.messages[result.messages.length - 1];
  const reply =
    typeof lastMessage.content === 'string'
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  const providerLabel = process.env.AI_PROVIDER ?? 'ollama';

  return {
    reply,
    model: `opsedge-ai/${providerLabel}`,
  };
}
