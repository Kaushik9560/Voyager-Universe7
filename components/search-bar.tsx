"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Sparkles, Mic } from "lucide-react";

interface SpeechRecognitionResultLike {
  [index: number]: {
    transcript: string;
  };
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    [index: number]: SpeechRecognitionResultLike;
    length: number;
  };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

const SUGGESTIONS = [
  "3-day weekend getaway to Goa for a couple",
  "Family trip to Manali with adventure activities",
  "Budget-friendly solo backpacking in Rajasthan",
];

interface SearchBarProps {
  initialQuery?: string;
}

export function SearchBar({ initialQuery = "" }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const runSearch = useCallback((rawQuery: string) => {
    const normalized = rawQuery.trim();
    if (!normalized) return;
    const next = new URLSearchParams();
    next.set("q", normalized);

    const existingFilters = searchParams.get("f");
    if (existingFilters) next.set("f", existingFilters);

    router.push(`/search?${next.toString()}`);
  }, [router, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionCtor =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = Array.from(
        { length: event.results.length - event.resultIndex },
        (_, idx) => event.results[event.resultIndex + idx]?.[0]?.transcript ?? "",
      )
        .join(" ")
        .trim();

      if (transcript) {
        setQuery(transcript);
        runSearch(transcript);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setMicError("Microphone permission denied. Please allow mic access.");
      } else if (event.error === "no-speech") {
        setMicError("No speech detected. Please try again.");
      } else {
        setMicError("Voice input failed. Please try again.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [runSearch]);

  const handleSearch = () => {
    runSearch(query);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleMicClick = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setMicError("Voice search is not supported in this browser.");
      return;
    }

    try {
      setMicError(null);
      if (isListening) {
        recognition.stop();
        setIsListening(false);
      } else {
        recognition.start();
        setIsListening(true);
      }
    } catch {
      setIsListening(false);
      setMicError("Unable to start microphone. Please retry.");
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div
        className="relative flex items-center gap-3 rounded-2xl px-6 py-5 transition-all duration-300 md:gap-4 md:px-7 md:py-6"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklch, var(--surface-strong) 82%, white 18%), color-mix(in oklch, var(--surface-soft) 82%, white 18%))",
          border: focused
            ? "1px solid oklch(0.72 0.15 205 / 0.62)"
            : "1px solid var(--glass-border)",
          backdropFilter: "blur(22px)",
          boxShadow: focused
            ? "0 0 0 3px oklch(0.7 0.15 200 / 0.12), 0 22px 44px oklch(0.14 0.03 240 / 0.12)"
            : "0 12px 28px oklch(0.14 0.03 240 / 0.08)",
        }}
      >
        <Search className="h-[22px] w-[22px] shrink-0" style={{ color: "var(--muted-foreground)" }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={handleKey}
          placeholder="Where do you want to go? Tell me everything..."
          className="flex-1 bg-transparent text-base font-medium outline-none md:text-lg"
          style={{
            color: "var(--foreground)",
            fontFamily: "var(--font-inter)",
          }}
        />
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
          style={{ color: isListening ? "var(--primary)" : "var(--muted-foreground)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--foreground)")}
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = isListening
              ? "var(--primary)"
              : "var(--muted-foreground)")
          }
          onClick={handleMicClick}
          disabled={!speechSupported}
          aria-label="Voice search"
          title={speechSupported ? "Use microphone" : "Voice search unsupported in this browser"}
        >
          <Mic className="h-4.5 w-4.5" />
        </button>
        <button
          onClick={handleSearch}
          disabled={!query.trim()}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-95 disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, var(--primary), oklch(0.74 0.19 44))",
            color: "var(--primary-foreground)",
            boxShadow: "0 10px 24px oklch(0.58 0.14 45 / 0.26), inset 0 1px 0 oklch(1 0 0 / 0.3)",
          }}
        >
          <Sparkles className="h-4 w-4" />
          Search
        </button>
      </div>

      {/* Quick suggestions */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted-foreground)" }}>
          Try:
        </span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setQuery(s)}
            className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-300 hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(130deg, var(--glass), color-mix(in oklch, var(--surface-soft) 72%, white 28%))",
              border: "1px solid var(--glass-border)",
              color: "var(--muted-foreground)",
              backdropFilter: "blur(10px)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(0.7 0.15 200 / 0.3)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 10px 18px oklch(0.17 0.03 240 / 0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--glass-border)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-foreground)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {micError ? (
        <p className="mt-2 text-xs" style={{ color: "#f87171" }}>
          {micError}
        </p>
      ) : null}
    </div>
  );
}
