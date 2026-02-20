/**
 * AI Provider Factory
 * Select model via AI_PROVIDER env var: ollama (default) | openai | claude
 */

import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export type AiProvider = 'ollama' | 'openai' | 'claude';

export function getAiProvider(): AiProvider {
  const raw = (process.env.AI_PROVIDER ?? 'ollama').toLowerCase();
  if (raw === 'openai') return 'openai';
  if (raw === 'claude') return 'claude';
  return 'ollama';
}

export function createAiModel(): BaseChatModel {
  const provider = getAiProvider();

  switch (provider) {
    case 'openai':
      return new ChatOpenAI({
        model: process.env.OPENAI_MODEL ?? 'gpt-4',
        apiKey: process.env.OPENAI_API_KEY,
        temperature: 0.2,
      });

    case 'claude':
      return new ChatAnthropic({
        model: process.env.CLAUDE_MODEL ?? 'claude-3-5-sonnet-20241022',
        apiKey: process.env.ANTHROPIC_API_KEY,
        temperature: 0.2,
      });

    case 'ollama':
    default:
      return new ChatOllama({
        baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
        model: process.env.OLLAMA_CHAT_MODEL ?? 'deepseek-r1:8b',
        temperature: 0.2,
      });
  }
}
