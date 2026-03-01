import { safeParseJson } from "@/lib/llm-json";

const AI_PROVIDER_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

interface AiRawOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

interface AiJsonOptions extends AiRawOptions {
  schemaHint: string;
}

interface AiContentPart {
  text?: string;
}

interface AiResponse {
  candidates?: Array<{
    content?: {
      parts?: AiContentPart[];
    };
  }>;
  error?: {
    message?: string;
  };
}

interface ModelListResponse {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
}

const LEGACY_API_KEY = "GEMINI_API_KEY";
const LEGACY_MODEL_KEY = "GEMINI_MODEL";

export function isAiConfigured() {
  return Boolean(readAiApiKey());
}

export function getAiModel() {
  return readAiModel();
}

export async function generateAiJson<T>(options: AiJsonOptions): Promise<T | null> {
  const raw = await callAiRaw(options);
  const parsed = safeParseJson<T>(raw);
  if (parsed) return parsed;

  const repairedRaw = await callAiRaw({
    systemPrompt:
      "You are a JSON repair assistant. Return ONLY valid JSON. No markdown, no extra text.",
    userPrompt: [
      "Fix the following malformed JSON-like output into strict valid JSON.",
      "Keep the same meaning and schema.",
      `Schema hint:\n${options.schemaHint}`,
      `Malformed text:\n${raw}`,
    ].join("\n\n"),
    temperature: 0,
    maxOutputTokens: options.maxOutputTokens,
  });

  return safeParseJson<T>(repairedRaw);
}

async function callAiRaw({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  maxOutputTokens = 1600,
}: AiRawOptions): Promise<string> {
  const resolvedKey = readAiApiKey();
  if (!resolvedKey) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const models = await getModelCandidates(resolvedKey);
  if (models.length === 0) {
    throw new Error("No AI model available. Set AI_MODEL or AI_MODEL_FALLBACKS.");
  }

  let lastError = "AI request failed.";

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    const url = `${AI_PROVIDER_BASE_URL}/models/${model}:generateContent?key=${resolvedKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            role: "system",
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature,
            maxOutputTokens,
            responseMimeType: "application/json",
          },
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI fetch failed.";
      throw new Error(message);
    }

    const payload = (await response.json().catch(() => ({}))) as AiResponse;
    if (!response.ok) {
      const message = payload?.error?.message || `AI request failed (${response.status})`;
      lastError = message;
      if (isModelUnavailable(message, response.status) && index < models.length - 1) {
        continue;
      }
      throw new Error(message);
    }

    const text =
      payload?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim() || "";

    if (!text) {
      lastError = "Empty response from AI model.";
      if (index < models.length - 1) continue;
      throw new Error(lastError);
    }

    return text;
  }

  throw new Error(lastError);
}

function readAiApiKey(): string {
  const direct = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || process.env.LLM_API_KEY;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const legacy = process.env[LEGACY_API_KEY];
  if (typeof legacy === "string" && legacy.trim()) return legacy.trim();

  for (const [key, value] of Object.entries(process.env)) {
    if (key.trim() === LEGACY_API_KEY && typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function readAiModel(): string {
  const direct = process.env.GEMINI_MODEL || process.env.AI_MODEL || process.env.LLM_MODEL;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const legacy = process.env[LEGACY_MODEL_KEY];
  if (typeof legacy === "string" && legacy.trim()) return legacy.trim();

  for (const [key, value] of Object.entries(process.env)) {
    if (key.trim() === LEGACY_MODEL_KEY && typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

async function getModelCandidates(apiKey: string): Promise<string[]> {
  const configured = readAiModel();
  const envFallbacks = String(process.env.GEMINI_MODEL_FALLBACKS || process.env.AI_MODEL_FALLBACKS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const discovered = await fetchAvailableModelNames(apiKey);
  return Array.from(new Set([configured, ...envFallbacks, ...discovered].filter(Boolean)));
}

async function fetchAvailableModelNames(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch(`${AI_PROVIDER_BASE_URL}/models?key=${apiKey}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });

    if (!response.ok) return [];

    const payload = (await response.json().catch(() => ({}))) as ModelListResponse;
    const rows = Array.isArray(payload.models) ? payload.models : [];

    const names = rows
      .filter((row) => {
        const methods = Array.isArray(row.supportedGenerationMethods) ? row.supportedGenerationMethods : [];
        return methods.length === 0 || methods.includes("generateContent");
      })
      .map((row) => {
        const raw = String(row.name || "").trim();
        const normalized = raw.startsWith("models/") ? raw.slice("models/".length) : raw;
        return normalized;
      })
      .filter(Boolean);

    const scored = names
      .map((name) => ({
        name,
        score:
          (name.toLowerCase().includes("flash") ? 3 : 0) +
          (name.toLowerCase().includes("lite") ? 2 : 0) +
          (name.toLowerCase().includes("pro") ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .map((row) => row.name);

    return Array.from(new Set(scored));
  } catch {
    return [];
  }
}

function isModelUnavailable(message: string, status: number): boolean {
  if (status === 404 || status === 400 || status === 403) {
    return /not found|not supported|unknown model|no longer available|deprecated|update your code|unavailable/i.test(
      message
    );
  }
  return false;
}
