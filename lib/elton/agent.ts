export const MODEL_NAME = "claude-sonnet-4-5";

export const CLAUDE_CONFIG = {
  max_tokens: 1024,
  temperature: 0.3,
};

export const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 5000,
};

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentOptions {
  conversationId: string;
  vagasLote1: number;
  history: ClaudeMessage[];
}

export async function callEltonAgent(options: AgentOptions): Promise<string> {
  const { history, vagasLote1 } = options;

  // Import dinâmico para evitar circular dependency
  const { getEltonSystemPrompt } = await import('./system');
  const systemPrompt = getEltonSystemPrompt(vagasLote1);

  const messages = history.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  const payload = {
    model: MODEL_NAME,
    max_tokens: CLAUDE_CONFIG.max_tokens,
    temperature: CLAUDE_CONFIG.temperature,
    system: systemPrompt,
    messages,
  };

  return executeWithRetry(payload);
}

async function executeWithRetry(payload: any, attempt = 1): Promise<string> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Sem corpo");
      const retryableStatus = [429, 500, 502, 503, 504];

      if (retryableStatus.includes(response.status) && attempt < RETRY_CONFIG.maxAttempts) {
        const delay = Math.min(RETRY_CONFIG.initialDelay * Math.pow(2, attempt - 1), RETRY_CONFIG.maxDelay);
        console.log(`[Elton] Retry ${attempt}/${RETRY_CONFIG.maxAttempts} (${delay}ms)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeWithRetry(payload, attempt + 1);
      }
      throw new Error(`Claude API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const content = Array.isArray(data.content)
      ? data.content.map((b: any) => b.text || "").join("")
      : data.content || "";

    if (process.env.NODE_ENV === "development") {
      console.log(`[Elton] Tokens | input: ${data.usage?.input_tokens} | output: ${data.usage?.output_tokens}`);
    }

    return content.trim();

  } catch (error) {
    if (attempt >= RETRY_CONFIG.maxAttempts) {
      console.error(`[Elton] Falha após ${RETRY_CONFIG.maxAttempts} tentativas:`, error);
      throw new Error("Não foi possível processar. Tente novamente.");
    }
    throw error;
  }
}

export function formatHistoryForClaude(
  frontendHistory: Array<{ role: string; content: string }>
): ClaudeMessage[] {
  return frontendHistory
    .filter(msg => msg.role === "user" || msg.role === "assistant")
    .map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));
}
