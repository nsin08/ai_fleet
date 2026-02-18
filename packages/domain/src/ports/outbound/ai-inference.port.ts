export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: false; // only non-streaming supported at port level; adapters may add SSE
}

export interface AiCompletionResult {
  content: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface AiEmbeddingResult {
  embedding: number[];
  model: string;
}

export interface AiInferencePort {
  generateCompletion(
    messages: AiMessage[],
    opts?: AiCompletionOptions,
  ): Promise<AiCompletionResult>;

  generateEmbedding?(text: string, model?: string): Promise<AiEmbeddingResult>;
}
