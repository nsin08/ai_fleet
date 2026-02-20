/**
 * OpsEdge AI — Context-Injection Agent
 *
 * Pre-fetches live fleet data and injects it as context before calling the LLM.
 * Works with any model (no tool-calling / function-calling support required).
 * Model is injected from the ai-provider factory (Ollama / OpenAI / Claude).
 */

import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createAiModel, getAiProvider } from '../../config/ai-provider.js';
import {
  getFleetSummaryTool,
  getTopDriversTool,
  getOpenAlertsTool,
  getOnTripVehiclesTool,
  getFuelAnomaliesTool,
} from './tools/index.js';

/* ── System Prompt ────────────────────────────────────────────────────────── */
const SYSTEM_PROMPT = `You are OpsEdge AI, the intelligent fleet operations assistant for FleetEdge.

You are provided with live fleet data as context below. Answer questions using ONLY the data provided. Never invent names, IDs, scores, or metrics that are not in the context.

Guidelines:
- Base your answers entirely on the live data provided in the context.
- Be concise and operational — fleet operators need fast, actionable answers.
- Reference real vehicle IDs, driver names, and alert IDs from the context.
- If data shows no issues, say so clearly. Do not fabricate concerns.
- Format numbers cleanly (e.g. "score: 87", "42 km/h", "14 open alerts").
- If Asked about something not covered by the data, say what data you have and what you cannot determine.

You are running on a fleet platform. Available modules: Vehicles, Drivers, Alerts, Dispatch, Fuel, Maintenance, Costs.`;

/* ── Context keywords → which tools to call ─────────────────────────────── */
type ToolKey = 'summary' | 'drivers' | 'alerts' | 'vehicles' | 'fuel';

function selectTools(message: string): Set<ToolKey> {
  const m = message.toLowerCase();
  const tools = new Set<ToolKey>(['summary']); // always fetch summary

  if (/driver|assign|shift|rotation|score|availab/.test(m)) tools.add('drivers');
  if (/alert|risk|warning|critical|overspeed|breach/.test(m)) tools.add('alerts');
  if (/vehicle|truck|bus|trip|on.?trip|transit|dispatch/.test(m)) tools.add('vehicles');
  if (/fuel|anomal|consumption|efficiency/.test(m)) tools.add('fuel');

  // broad queries — fetch everything
  if (/status|overview|summary|fleet|all|list|show|what/.test(m)) {
    tools.add('drivers');
    tools.add('alerts');
    tools.add('vehicles');
  }

  return tools;
}

/* ── Fetch fleet context ─────────────────────────────────────────────────── */
async function gatherFleetContext(message: string): Promise<string> {
  const needed = selectTools(message);
  const sections: string[] = [];

  const fetches: Promise<void>[] = [];

  if (needed.has('summary')) {
    fetches.push(
      getFleetSummaryTool.invoke({}).then((r) => {
        sections.push(`## Fleet Summary\n${r}`);
      }),
    );
  }
  if (needed.has('drivers')) {
    fetches.push(
      getTopDriversTool.invoke({ limit: 10 }).then((r) => {
        sections.push(`## Top Drivers (by shift score)\n${r}`);
      }),
    );
  }
  if (needed.has('alerts')) {
    fetches.push(
      getOpenAlertsTool.invoke({ limit: 20 }).then((r) => {
        sections.push(`## Open Alerts\n${r}`);
      }),
    );
  }
  if (needed.has('vehicles')) {
    fetches.push(
      getOnTripVehiclesTool.invoke({}).then((r) => {
        sections.push(`## On-Trip Vehicles\n${r}`);
      }),
    );
  }
  if (needed.has('fuel')) {
    fetches.push(
      getFuelAnomaliesTool.invoke({ limit: 10 }).then((r) => {
        sections.push(`## Fuel Anomalies\n${r}`);
      }),
    );
  }

  await Promise.all(fetches);
  return sections.join('\n\n');
}

/* ── Model singleton (lazily initialised) ────────────────────────────────── */
let _model: BaseChatModel | null = null;

function getModel(): BaseChatModel {
  if (!_model) {
    _model = createAiModel();
  }
  return _model;
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
  const [fleetContext] = await Promise.all([gatherFleetContext(message)]);

  const systemWithContext = `${SYSTEM_PROMPT}\n\n---\n## Live Fleet Data (fetched now)\n\n${fleetContext}\n---`;

  const llmMessages = [
    new SystemMessage(systemWithContext),
    ...history.map((h) =>
      h.role === 'user' ? new HumanMessage(h.content) : new AIMessage(h.content),
    ),
    new HumanMessage(message),
  ];

  const model = getModel();
  const response = await model.invoke(llmMessages);
  const reply = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content);

  const provider = getAiProvider();
  const modelTag = `opsedge-ai/${provider}`;

  return { reply, model: modelTag };
}
