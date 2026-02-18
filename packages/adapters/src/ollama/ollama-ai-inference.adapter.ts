import { Ollama } from 'ollama';
import type {
  AiInferencePort,
  AiMessage,
  AiCompletionOptions,
  AiCompletionResult,
  AiEmbeddingResult,
} from '@ai-fleet/domain';

const DEFAULT_CHAT_MODEL =
  process.env['OLLAMA_CHAT_MODEL'] ?? 'deepseek-r1:8b';
const DEFAULT_EMBED_MODEL =
  process.env['OLLAMA_EMBED_MODEL'] ?? 'mxbai-embed-large:latest';
const OLLAMA_BASE_URL =
  process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434';

export class OllamaAiInferenceAdapter implements AiInferencePort {
  private readonly ollama: Ollama;

  constructor() {
    this.ollama = new Ollama({ host: OLLAMA_BASE_URL });
  }

  async generateCompletion(
    messages: AiMessage[],
    opts: AiCompletionOptions = {},
  ): Promise<AiCompletionResult> {
    const model = opts.model ?? DEFAULT_CHAT_MODEL;

    const response = await this.ollama.chat({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      options: {
        temperature: opts.temperature ?? 0.3,
        num_predict: opts.maxTokens ?? 1024,
      },
      stream: false,
    });

    return {
      content: response.message.content,
      model: response.model,
      promptTokens: response.prompt_eval_count,
      completionTokens: response.eval_count,
    };
  }

  async generateEmbedding(
    text: string,
    model?: string,
  ): Promise<AiEmbeddingResult> {
    const m = model ?? DEFAULT_EMBED_MODEL;
    const response = await this.ollama.embeddings({ model: m, prompt: text });
    return { embedding: response.embedding, model: m };
  }
}
