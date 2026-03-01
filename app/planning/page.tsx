"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Globe, Sparkles, Mic, LogOut } from "lucide-react";

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
  "Delhi to Goa for 5 days, couple trip",
  "Family vacation Manali 7 days",
  "Solo trip Rajasthan 4 days budget",
  "Mumbai to Maldives honeymoon 6 nights",
  "Backpacking Kerala 10 days",
];

const DESTINATION_SLIDES = [
  {
    title: "Santorini, Greece",
    subtitle: "Iconic cliff sunsets and Aegean serenity",
    image:
      "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=2200&q=90",
  },
  {
    title: "Swiss Alps",
    subtitle: "Snow-capped peaks, trains and postcard villages",
    image:
      "https://images.unsplash.com/photo-1508261305436-4d25f4b92e7f?auto=format&fit=crop&w=2200&q=90",
  },
  {
    title: "Kyoto, Japan",
    subtitle: "Temples, lantern streets and timeless culture",
    image:
      "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=2200&q=90",
  },
  {
    title: "Dubai, UAE",
    subtitle: "Skyline luxury and desert adventures",
    image:
      "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=2200&q=90",
  },
];

export default function PlanningPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const runSearch = useCallback((rawQuery: string) => {
    const normalized = rawQuery.trim();
    if (!normalized) return;
    router.push(`/search?q=${encodeURIComponent(normalized)}`);
  }, [router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % DESTINATION_SLIDES.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, []);

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

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="voyager-page-shell relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--background)]">
      <button
        type="button"
        onClick={handleLogout}
        className="voyager-btn-secondary absolute right-5 top-5 z-20 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
        style={{
          color: "var(--foreground)",
        }}
      >
        <LogOut className="h-3.5 w-3.5" />
        Logout
      </button>

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {DESTINATION_SLIDES.map((slide, index) => (
          <div
            key={slide.title}
            className="absolute inset-0 transition-opacity duration-700"
            style={{
              opacity: activeSlide === index ? 0.78 : 0,
              backgroundImage: `url(${slide.image})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
              filter: "saturate(1.24) contrast(1.08) brightness(1.08)",
            }}
          />
        ))}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.99 0.01 95 / 0.08) 0%, oklch(0.96 0.01 210 / 0.2) 40%, oklch(0.1 0.02 240 / 0.56) 100%)",
          }}
        />
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            animationDuration: "4.2s",
            background:
              "radial-gradient(circle at 22% 18%, oklch(0.76 0.16 190 / 0.26) 0%, transparent 38%), radial-gradient(circle at 78% 16%, oklch(0.74 0.15 42 / 0.22) 0%, transparent 40%)",
          }}
        />
      </div>

      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <main
        className="relative z-10 flex w-full flex-col items-center px-4"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: "var(--glass)",
              border: "1px solid var(--glass-border)",
              boxShadow: "0 0 40px oklch(0.7 0.15 200 / 0.15)",
            }}
          >
            <Globe
              className="h-8 w-8"
              style={{ color: "var(--primary)" }}
            />
          </div>
          <div className="text-center">
            <h1
              className="text-4xl font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-inter)",
                background: "linear-gradient(135deg, var(--foreground), var(--primary))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Voyager
            </h1>
            <p
              className="mt-1 text-sm tracking-widest uppercase"
              style={{ color: "var(--muted-foreground)", letterSpacing: "0.2em" }}
            >
              Smart Travel Search
            </p>
          </div>
        </div>

        <div className="mb-6 w-full max-w-2xl">
          <div
            className="voyager-glass-card rounded-2xl px-4 py-3"
            style={{
              backdropFilter: "blur(14px)",
            }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {DESTINATION_SLIDES[activeSlide].title}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
              {DESTINATION_SLIDES[activeSlide].subtitle}
            </p>
            <div className="mt-2 flex gap-1.5">
              {DESTINATION_SLIDES.map((slide, index) => (
                <span
                  key={slide.title}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: activeSlide === index ? "22px" : "8px",
                    background: activeSlide === index ? "var(--primary)" : "var(--glass-border)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="w-full max-w-2xl">
          <div
            className="voyager-glass-card relative flex items-center gap-3 rounded-2xl px-5 py-4 transition-all duration-300"
            style={{
              border: focused
                ? "1px solid oklch(0.7 0.15 200 / 0.5)"
                : "1px solid var(--glass-border)",
              backdropFilter: "blur(20px)",
              boxShadow: focused
                ? "0 0 0 3px oklch(0.7 0.15 200 / 0.08), 0 8px 32px oklch(0 0 0 / 0.4)"
                : "0 8px 32px oklch(0 0 0 / 0.3)",
            }}
          >
            <Search
              className="h-5 w-5 shrink-0"
              style={{ color: "var(--muted-foreground)" }}
            />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={handleKey}
              placeholder="Where do you want to go?"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{
                color: "var(--foreground)",
                fontFamily: "var(--font-inter)",
              }}
            />
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
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
              <Mic className="h-4 w-4" />
            </button>
            <button
              onClick={handleSearch}
              disabled={!query.trim()}
              className="voyager-btn-primary flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                color: "var(--primary-foreground)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Search
            </button>
          </div>
          {micError ? (
            <p className="mt-2 text-xs" style={{ color: "#f87171" }}>
              {micError}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              Try:
            </span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="voyager-btn-secondary rounded-full px-3 py-1 text-xs transition-all duration-200"
                style={{
                  color: "var(--muted-foreground)",
                  backdropFilter: "blur(8px)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(0.7 0.15 200 / 0.4)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--glass-border)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-foreground)";
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <p
          className="mt-12 text-center text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          Flights - Hotels - Activities - Dining - all in one search
        </p>
      </main>
    </div>
  );
}
