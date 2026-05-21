/**
 * ELTON AGENT — Integração com Claude API (Anthropic)
 * Modelo ativo: Claude Sonnet 4.6 (família Claude 4)
 */

import { getEltonSystemPrompt } from './system';

// IDENTIFICADOR DO MODELO (conforme sua especificação)
export const MODEL_NAME = "claude-sonnet-4-6";

// PARÂMETROS OTIMIZADOS PARA SONNET 4.6
export const CLAUDE_CONFIG = {
  max_tokens: 1024,
  temperature: 0.3,        // Consistência máxima para regras rígidas e memória contextual
  top_p: 0.9,
  top_k: 40,
  stop_sequences: [],
};

// CONFIGURAÇÃO DE RETRY (tolerância a picos de latência)
export const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 5000,
};

// TIPOS
export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentOptions {
  conversationId: string;
  vagasLote1: number;
  history: ClaudeMessage[];
}

/**
 * Chamada principal ao Sonnet 4.6
 */
export async function callEltonAgent(options: AgentOptions): Promise<string> {
  const { history, vagasLote1 } = options;
  const systemPrompt = getEltonSystemPrompt(vagasLote1);

  const messages = history.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  const payload = {
    model: MODEL_NAME,
    max_tokens: CLAUDE_CONFIG.max_tokens,
    temperature: CLAUDE_CONFIG.temperature,
    top_p: CLAUDE_CONFIG.top_p,
    top_k: CLAUDE_CONFIG.top_k,
    system: systemPrompt,
    messages,
  };

  return executeWithRetry(payload);
}

/**
 * Retry exponencial + tratamento de resposta
 */
async function executeWithRetry(payload: any, attempt = 1): Promise<string> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.CLAUDE_API_KEY || "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Sem corpo de erro");
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
      throw new Error("Não foi possível processar sua solicitação. Tente novamente em instantes.");
    }
    throw error;
  }
}
