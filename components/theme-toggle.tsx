"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Palette } from "lucide-react";

type ThemeMode = "sunrise" | "ocean" | "forest" | "sunset" | "aurora" | "midnight";

interface ThemeOption {
  id: ThemeMode;
  label: string;
  swatch: string;
}

const STORAGE_KEY = "voyager-theme";
const THEME_OPTIONS: ThemeOption[] = [
  { id: "sunrise", label: "Sunrise", swatch: "linear-gradient(135deg, #ff9b54, #ffd166)" },
  { id: "ocean", label: "Ocean", swatch: "linear-gradient(135deg, #00a6fb, #44d4b0)" },
  { id: "forest", label: "Forest", swatch: "linear-gradient(135deg, #2a9d8f, #84cc16)" },
  { id: "sunset", label: "Sunset", swatch: "linear-gradient(135deg, #f97316, #ec4899)" },
  { id: "aurora", label: "Aurora", swatch: "linear-gradient(135deg, #14b8a6, #6366f1)" },
  { id: "midnight", label: "Midnight", swatch: "linear-gradient(135deg, #4f46e5, #22d3ee)" },
];

function normalizeTheme(raw: string | null): ThemeMode {
  if (raw === "light") return "sunrise";
  if (raw === "dark") return "midnight";
  if (
    raw === "sunrise" ||
    raw === "ocean" ||
    raw === "forest" ||
    raw === "sunset" ||
    raw === "aurora" ||
    raw === "midnight"
  ) {
    return raw;
  }
  return "sunrise";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem(STORAGE_KEY, theme);
}

function resolveInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "sunrise";
  return normalizeTheme(window.localStorage.getItem(STORAGE_KEY));
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("sunrise");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const activeTheme = useMemo(
    () => THEME_OPTIONS.find((option) => option.id === theme) || THEME_OPTIONS[0],
    [theme]
  );

  useEffect(() => {
    const resolved = resolveInitialTheme();
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current || rootRef.current.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  const selectTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="fixed right-5 bottom-5 z-[85]">
      {open ? (
        <div
          className="mb-2 w-44 rounded-2xl border p-2"
          style={{
            borderColor: "var(--glass-border)",
            background: "var(--surface-strong)",
            backdropFilter: "blur(16px)",
          }}
        >
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
            Joyful themes
          </p>
          <div className="space-y-1">
            {THEME_OPTIONS.map((option) => {
              const active = option.id === theme;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectTheme(option.id)}
                  className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-sm transition hover:brightness-110"
                  style={{
                    background: active ? "var(--glass)" : "transparent",
                    color: "var(--foreground)",
                  }}
                >
                  <span>{option.label}</span>
                  <span
                    className="inline-flex h-4 w-4 rounded-full border"
                    style={{ background: option.swatch, borderColor: "var(--glass-border)" }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open theme selector"
        title={`Current theme: ${activeTheme.label}`}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full border transition-all hover:scale-105 active:scale-95"
        style={{
          borderColor: "var(--glass-border)",
          background: "var(--glass)",
          color: "var(--foreground)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 10px 24px oklch(0 0 0 / 0.18)",
        }}
      >
        <Palette className="h-5 w-5" />
      </button>
    </div>
  );
}
