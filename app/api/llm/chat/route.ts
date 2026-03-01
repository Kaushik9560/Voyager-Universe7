import { NextResponse } from "next/server";
import { generateAiJson, getAiModel, isAiConfigured } from "@/lib/ai";

type ChatRole = "user" | "assistant" | "system";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ChatContextPayload {
  currentQuery: string | null;
  currentFilters: Record<string, unknown> | null;
  resultsSummary: Record<string, unknown> | null;
}

interface ChatRequestBody {
  messages: ChatMessage[];
  context: ChatContextPayload;
}

interface ChatOption {
  id: string;
  label: string;
  value: string;
}

interface UpdateSearchAction {
  type: "UPDATE_SEARCH";
  payload: {
    queryPatch: Record<string, unknown>;
    filterPatch: Record<string, unknown>;
  };
}

interface GenerateItineraryAction {
  type: "GENERATE_ITINERARY";
}

type ChatAction = GenerateItineraryAction | UpdateSearchAction;

interface ChatResponseBody {
  reply: string;
  options: ChatOption[] | null;
  nextQuestion: string | null;
  actions: ChatAction[] | null;
}

const CHAT_SYSTEM_PROMPT = `
You are Voyager AI assistant.
Respond in a natural conversational style: clear, direct, context-aware, and human.

Return ONLY valid JSON matching this schema:
{
  "reply": string,
  "options": null | [{ "id": string, "label": string, "value": string }],
  "nextQuestion": null | string,
  "actions": null | [
    { "type":"GENERATE_ITINERARY" } |
    { "type":"UPDATE_SEARCH", "payload": { "queryPatch": object, "filterPatch": object } }
  ]
}

Rules:
1) Output only JSON. No markdown.
2) Use currentQuery, currentFilters, and resultsSummary heavily.
3) Keep reply concise (typically 3-8 lines).
4) Ask at most one focused follow-up question via nextQuestion only when needed.
5) Keep options null by default; include max 3 only if quick choices are genuinely useful.
6) If user asks for itinerary/day-wise trip plan, include action GENERATE_ITINERARY.
7) Never reveal keys, secrets, or internal values.
8) If context is missing, say what is missing and continue with best effort.
`.trim();

const CHAT_SCHEMA_HINT = `
reply: string
options: null | array of up to 3 items {id,label,value}
nextQuestion: null | string
actions: null | array of GENERATE_ITINERARY or UPDATE_SEARCH
`.trim();

function sanitizeOptions(raw: unknown): ChatOption[] | null {
  if (!Array.isArray(raw)) return null;
  const mapped = raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Record<string, unknown>;
      const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
      const value = typeof candidate.value === "string" ? candidate.value.trim() : "";
      if (!label || !value) return null;
      return {
        id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : `opt${index + 1}`,
        label,
        value,
      };
    })
    .filter((item): item is ChatOption => Boolean(item));

  return mapped.length ? mapped.slice(0, 3) : null;
}

function sanitizeActions(raw: unknown): ChatAction[] | null {
  if (!Array.isArray(raw)) return null;
  const actions: ChatAction[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const action = item as Record<string, unknown>;

    if (action.type === "GENERATE_ITINERARY") {
      actions.push({ type: "GENERATE_ITINERARY" });
      continue;
    }

    if (action.type === "UPDATE_SEARCH") {
      const payload = action.payload as Record<string, unknown> | undefined;
      actions.push({
        type: "UPDATE_SEARCH",
        payload: {
          queryPatch:
            payload && typeof payload.queryPatch === "object" && payload.queryPatch
              ? (payload.queryPatch as Record<string, unknown>)
              : {},
          filterPatch:
            payload && typeof payload.filterPatch === "object" && payload.filterPatch
              ? (payload.filterPatch as Record<string, unknown>)
              : {},
        },
      });
    }
  }

  return actions.length ? actions : null;
}

function normalizeChatResponse(raw: unknown): ChatResponseBody {
  if (!raw || typeof raw !== "object") {
    return {
      reply: "I could not process that request. Please try again.",
      options: null,
      nextQuestion: null,
      actions: null,
    };
  }

  const obj = raw as Record<string, unknown>;

  return {
    reply:
      typeof obj.reply === "string" && obj.reply.trim()
        ? obj.reply.trim()
        : "I could not process that request. Please try again.",
    options: sanitizeOptions(obj.options),
    nextQuestion: typeof obj.nextQuestion === "string" && obj.nextQuestion.trim() ? obj.nextQuestion.trim() : null,
    actions: sanitizeActions(obj.actions),
  };
}

function summarizeContext(context: ChatContextPayload): string {
  const summary = context.resultsSummary || {};
  const flights = Array.isArray((summary as Record<string, unknown>).flights)
    ? ((summary as Record<string, unknown>).flights as unknown[]).length
    : 0;
  const hotels = Array.isArray((summary as Record<string, unknown>).hotels)
    ? ((summary as Record<string, unknown>).hotels as unknown[]).length
    : 0;
  const activities = Array.isArray((summary as Record<string, unknown>).activities)
    ? ((summary as Record<string, unknown>).activities as unknown[]).length
    : 0;
  const restaurants = Array.isArray((summary as Record<string, unknown>).restaurants)
    ? ((summary as Record<string, unknown>).restaurants as unknown[]).length
    : 0;

  return [
    `query=${context.currentQuery || "n/a"}`,
    `results(flights=${flights}, hotels=${hotels}, activities=${activities}, restaurants=${restaurants})`,
  ].join("; ");
}

function getLatestUserMessage(messages: ChatMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return messages[index].content || "";
  }
  return "";
}

function isItineraryIntent(text: string): boolean {
  return /\b(itinerary|day[- ]?wise|trip plan|plan my trip|travel plan)\b/i.test(text);
}

export async function POST(request: Request) {
  try {
    if (!isAiConfigured()) {
      return NextResponse.json(
        {
          error: "AI_NOT_CONFIGURED",
          message: "AI not configured. Add AI_API_KEY in .env.local.",
          model: getAiModel(),
        },
        { status: 503 }
      );
    }

    const body = ((await request.json().catch(() => ({}))) || {}) as ChatRequestBody;
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const context: ChatContextPayload = body?.context || {
      currentQuery: null,
      currentFilters: null,
      resultsSummary: null,
    };

    const compactConversation = messages
      .slice(-12)
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join("\n");

    const userPrompt = [
      `Context Snapshot: ${summarizeContext(context)}`,
      "",
      "Context JSON:",
      JSON.stringify(context, null, 2),
      "",
      "Conversation (latest at bottom):",
      compactConversation || "No conversation history.",
      "",
      "Respond with strict JSON only.",
    ].join("\n");

    const modelResponse = await generateAiJson<ChatResponseBody>({
      systemPrompt: CHAT_SYSTEM_PROMPT,
      userPrompt,
      schemaHint: CHAT_SCHEMA_HINT,
      maxOutputTokens: 1000,
      temperature: 0.3,
    });

    const normalized = normalizeChatResponse(modelResponse);
    const latestUserMessage = getLatestUserMessage(messages);
    if (
      isItineraryIntent(latestUserMessage) &&
      !(normalized.actions || []).some((action) => action.type === "GENERATE_ITINERARY")
    ) {
      normalized.actions = [...(normalized.actions || []), { type: "GENERATE_ITINERARY" }];
    }

    return NextResponse.json(normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        reply: "I am unable to respond right now. Please try again shortly.",
        options: null,
        nextQuestion: null,
        actions: null,
        error: message,
      },
      { status: 500 }
    );
  }
}
