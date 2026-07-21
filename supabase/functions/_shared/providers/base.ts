// ── Base types for AI provider adapters ─────────────────────────────────────

export interface ProviderConfig {
  name: string;
  provider: string;
  api_key: string | null;
  base_url: string;
  model: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: { input: number; output: number };
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

// ── Base adapter interface ──────────────────────────────────────────────────

export interface ProviderAdapter {
  /** Build the fetch Request for a non-streaming chat completion */
  buildRequest(config: ProviderConfig, req: ChatRequest): { url: string; init: RequestInit };

  /** Build the fetch Request for a streaming chat completion */
  buildStreamRequest(config: ProviderConfig, req: ChatRequest): { url: string; init: RequestInit };

  /** Parse a non-streaming response into ChatResponse */
  parseResponse(resp: Response): Promise<ChatResponse>;

  /** Parse a single SSE line into a StreamChunk (or null if not a content chunk) */
  parseStreamLine(line: string): StreamChunk | null;
}

// ── Default base URLs ───────────────────────────────────────────────────────

export const DEFAULT_URLS: Record<string, string> = {
  openai: "https://api.openai.com",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com",
  mistral: "https://api.mistral.ai",
  ollama: "http://localhost:11434",
  cosmos: "http://localhost:8000",
  nvidia_nim: "https://integrate.api.nvidia.com",
};

// ── Model suggestions per provider ──────────────────────────────────────────

export const DEFAULT_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini"],
  anthropic: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"],
  google: ["gemini-2.5-flash", "gemini-2.5-pro"],
  mistral: ["mistral-large-latest", "mistral-medium-latest"],
  ollama: ["llama3.1", "mistral"],
  cosmos: ["Cosmos3-Nano", "Cosmos3-Super"],
  nvidia_nim: ["nvidia/llama-3.1-nemotron-70b-instruct", "nvidia/cosmos-reason2-8b", "deepseek-ai/deepseek-v4-flash"],
};
