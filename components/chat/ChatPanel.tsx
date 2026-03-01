"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";
import type { ResultsSummary } from "@/lib/results-summary";

type MessageRole = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
}

interface ChatOption {
  id: string;
  label: string;
  value: string;
}

interface ChatAction {
  type: "GENERATE_ITINERARY" | "UPDATE_SEARCH";
}

interface ChatResponsePayload {
  reply: string;
  options: ChatOption[] | null;
  nextQuestion: string | null;
  actions: ChatAction[] | null;
  message?: string;
}

interface ItineraryItem {
  time: string;
  type: "flight" | "hotel" | "activity" | "food" | "transfer";
  title: string;
  description: string;
  estimatedCost: number;
  source: "results" | "suggested";
  sourceRef: string | null;
}

interface ItineraryDay {
  day: number;
  theme: string;
  items: ItineraryItem[];
}

interface ItineraryPayload {
  title: string;
  summary: string;
  totalDays: number;
  days: ItineraryDay[];
  budgetEstimate: {
    min: number;
    max: number;
    currency: string;
  };
  packingSuggestions: string[];
  tips: string[];
}

interface ChatContext {
  currentQuery: string | null;
  currentFilters: unknown;
  resultsSummary: ResultsSummary | null;
}

interface ChatPanelProps {
  context: ChatContext;
}

function isItineraryIntent(text: string) {
  return /\b(itinerary|day[- ]?wise|trip plan|plan my trip|travel plan)\b/i.test(text);
}

function formatItineraryText(payload: ItineraryPayload) {
  const lines: string[] = [];
  lines.push(`${payload.title}`);
  lines.push(`${payload.summary}`);
  lines.push("");
  lines.push(`Total Days: ${payload.totalDays}`);
  lines.push(
    `Estimated Budget: ${payload.budgetEstimate.currency} ${payload.budgetEstimate.min.toLocaleString()} - ${payload.budgetEstimate.max.toLocaleString()}`
  );
  lines.push("");

  for (const day of payload.days) {
    lines.push(`Day ${day.day}: ${day.theme}`);
    for (const item of day.items) {
      lines.push(
        `- ${item.time} | ${item.type.toUpperCase()} | ${item.title} (₹${Math.max(
          0,
          Math.round(item.estimatedCost)
        ).toLocaleString()})`
      );
      lines.push(`  ${item.description}`);
    }
    lines.push("");
  }

  if (payload.packingSuggestions.length) {
    lines.push(`Packing: ${payload.packingSuggestions.join(", ")}`);
  }
  if (payload.tips.length) {
    lines.push(`Tips: ${payload.tips.join(" | ")}`);
  }

  return lines.join("\n");
}

function extractPreferences(currentFilters: unknown) {
  if (!currentFilters || typeof currentFilters !== "object") {
    return {
      pace: "Balanced" as const,
      days: 3,
      budgetMin: null,
      budgetMax: null,
    };
  }

  const filters = currentFilters as Record<string, unknown>;

  const paceRaw = filters.tripPace;
  const pace =
    paceRaw === "Relaxed" || paceRaw === "Balanced" || paceRaw === "Packed"
      ? paceRaw
      : ("Balanced" as const);

  const durationDays = Array.isArray(filters.durationDays) ? (filters.durationDays as unknown[]) : [];
  const daysValue =
    durationDays.length >= 2 && Number.isFinite(Number(durationDays[1]))
      ? Math.max(1, Number(durationDays[1]))
      : 3;

  const budget = Array.isArray(filters.budget) ? (filters.budget as unknown[]) : [];
  const budgetMin = budget.length >= 1 && Number.isFinite(Number(budget[0])) ? Number(budget[0]) : null;
  const budgetMax = budget.length >= 2 && Number.isFinite(Number(budget[1])) ? Number(budget[1]) : null;

  return {
    pace,
    days: daysValue,
    budgetMin,
    budgetMax,
  };
}

function countActiveFilterSelections(currentFilters: unknown): number {
  if (!currentFilters || typeof currentFilters !== "object") return 0;

  const filters = currentFilters as Record<string, unknown>;
  let count = 0;

  const listKeys = ["travellerTypes", "travelMonths", "destinationVibes", "accommodationTypes"];
  for (const key of listKeys) {
    const value = filters[key];
    if (Array.isArray(value)) count += value.length;
  }

  if (typeof filters.tripPace === "string" && filters.tripPace.trim()) count += 1;

  const togglesKeys = ["flights", "stay", "dining", "activities", "localTransport", "special", "offers"];
  for (const key of togglesKeys) {
    const value = filters[key];
    if (!value || typeof value !== "object") continue;
    for (const nested of Object.values(value as Record<string, unknown>)) {
      if (nested === true) count += 1;
    }
  }

  return count;
}

export function ChatPanel({ context }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I am your AI travel copilot. Ask naturally with AI and I will use your current search context.",
    },
  ]);
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<ChatOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [itineraryLoading, setItineraryLoading] = useState(false);
  const [starterUsed, setStarterUsed] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const sending = loading || itineraryLoading;
  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);
  const canGenerateItinerary = useMemo(
    () => Boolean(context.currentQuery || context.resultsSummary) && !sending,
    [context.currentQuery, context.resultsSummary, sending]
  );

  const contextPills = useMemo(() => {
    const pills: string[] = [];
    if (context.currentQuery) pills.push(`Query: ${context.currentQuery}`);
    const activeFilters = countActiveFilterSelections(context.currentFilters);
    if (activeFilters > 0) pills.push(`Active Filters: ${activeFilters}`);

    const summary = context.resultsSummary;
    if (summary) {
      pills.push(`Flights: ${summary.flights.length}`);
      pills.push(`Hotels: ${summary.hotels.length}`);
      pills.push(`Activities: ${summary.activities.length}`);
      pills.push(`Food: ${summary.restaurants.length}`);
    }
    return pills;
  }, [context.currentFilters, context.currentQuery, context.resultsSummary]);

  const starterPrompts = useMemo(() => {
    const route = context.currentQuery || "my current trip";
    return [
      `Give me best plan for ${route}`,
      "What should I optimize to reduce budget?",
      "Generate a day-wise itinerary from current results",
    ];
  }, [context.currentQuery]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, options, loading, itineraryLoading]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.focus();
  }, []);

  const callChat = async (nextMessages: ChatMessage[]) => {
    setLoading(true);
    try {
      const response = await fetch("/api/llm/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.content,
          })),
          context,
        }),
      });

      const payload = (await response.json()) as ChatResponsePayload & {
        error?: string;
      };

      if (!response.ok) {
        const configuredMessage =
          payload?.error === "AI_NOT_CONFIGURED"
            ? "AI not configured. Please set AI_API_KEY in .env.local."
            : payload?.message || "Chat request failed. Please retry.";
        setMessages((prev) => [
          ...prev,
          { id: `assistant-${Date.now()}`, role: "assistant", content: configuredMessage },
        ]);
        setOptions(null);
        return;
      }

      const assistantMessage = payload.reply || "I could not generate a response right now.";
      const mergedResponse = payload.nextQuestion
        ? `${assistantMessage}\n\n${payload.nextQuestion}`
        : assistantMessage;

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: mergedResponse,
        },
      ]);
      setOptions(Array.isArray(payload.options) && payload.options.length ? payload.options : null);

      if (Array.isArray(payload.actions) && payload.actions.some((action) => action.type === "GENERATE_ITINERARY")) {
        await requestItinerary("Creating a day-wise itinerary from your current context...");
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "Unable to reach AI assistant right now. Please try again.",
        },
      ]);
      setOptions(null);
    } finally {
      setLoading(false);
    }
  };

  const requestItinerary = async (preludeText?: string) => {
    if (itineraryLoading) return;
    setItineraryLoading(true);
    setOptions(null);

    try {
      if (preludeText) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-prelude-${Date.now()}`,
            role: "assistant",
            content: preludeText,
          },
        ]);
      }

      const preferences = extractPreferences(context.currentFilters);
      const response = await fetch("/api/llm/itinerary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context,
          preferences,
        }),
      });

      const payload = (await response.json()) as ItineraryPayload & {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        const configuredMessage =
          payload?.error === "AI_NOT_CONFIGURED"
            ? "AI not configured. Please set AI_API_KEY in .env.local."
            : payload?.message || "Unable to generate itinerary right now.";
        setMessages((prev) => [
          ...prev,
          { id: `assistant-${Date.now()}`, role: "assistant", content: configuredMessage },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-itinerary-${Date.now()}`,
          role: "assistant",
          content: formatItineraryText(payload),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "Unable to generate itinerary right now. Please try again.",
        },
      ]);
    } finally {
      setItineraryLoading(false);
    }
  };

  const sendUserMessage = async (content: string) => {
    const text = content.trim();
    if (!text || sending) return;

    setStarterUsed(true);
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setOptions(null);

    if (isItineraryIntent(text)) {
      await requestItinerary("Creating a day-wise itinerary from your current context...");
      return;
    }

    await callChat(nextMessages);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    await sendUserMessage(text);
  };

  const onInputKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    await sendUserMessage(text);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-4" style={{ borderColor: "var(--glass-border)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
          AI Chat
        </h2>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Context-aware from your query, filters, and live results.
        </p>
        {contextPills.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {contextPills.map((pill) => (
              <span
                key={pill}
                className="rounded-full border px-2 py-0.5 text-[11px]"
                style={{
                  borderColor: "var(--glass-border)",
                  background: "var(--glass)",
                  color: "var(--muted-foreground)",
                }}
              >
                {pill}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!starterUsed && messages.length <= 1 ? (
          <div className="space-y-2 rounded-2xl border p-3" style={{ borderColor: "var(--glass-border)" }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
              Try asking
            </p>
            <div className="flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendUserMessage(prompt)}
                  className="rounded-full border px-3 py-1 text-xs font-medium transition hover:brightness-110"
                  style={{
                    borderColor: "var(--glass-border)",
                    background: "var(--glass)",
                    color: "var(--foreground)",
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[94%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                  isUser ? "rounded-br-md" : "rounded-bl-md"
                }`}
                style={
                  isUser
                    ? {
                        background: "var(--primary)",
                        color: "var(--primary-foreground)",
                      }
                    : {
                        background: "var(--glass)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--foreground)",
                      }
                }
              >
                <div className="mb-1 flex items-center gap-1.5 text-[11px] opacity-75">
                  {isUser ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                  {isUser ? "You" : "Voyager AI"}
                </div>
                {message.content}
              </div>
            </div>
          );
        })}

        {options && options.length ? (
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => sendUserMessage(option.value)}
                className="rounded-full border px-3 py-1 text-xs font-medium transition hover:brightness-110"
                style={{
                  borderColor: "var(--glass-border)",
                  background: "var(--glass)",
                  color: "var(--foreground)",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        {sending ? (
          <div className="flex justify-start">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass)",
                color: "var(--muted-foreground)",
              }}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
              Thinking...
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t p-3" style={{ borderColor: "var(--glass-border)" }}>
        <form onSubmit={onSubmit} className="space-y-2">
          <div
            className="rounded-xl border px-2 py-2"
            style={{
              borderColor: "var(--glass-border)",
              background: "var(--glass)",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Ask anything about this trip context..."
              className="max-h-40 min-h-[48px] w-full resize-y bg-transparent px-1 py-1 text-sm outline-none"
              style={{ color: "var(--foreground)" }}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => requestItinerary("Creating a day-wise itinerary from your current context...")}
              disabled={!canGenerateItinerary}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass)",
                color: "var(--foreground)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Itinerary
            </button>

            <button
              type="submit"
              disabled={!canSend}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
