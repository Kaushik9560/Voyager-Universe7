"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  Clock3,
  Hotel,
  IndianRupee,
  MapPinned,
  Plane,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { readItineraryFromSession, type ItineraryItem, type SavedItinerary } from "@/lib/itinerary-storage";

const ITEM_META: Record<
  ItineraryItem["type"],
  { label: string; color: string; bg: string; icon: typeof Plane }
> = {
  flight: {
    label: "Flight",
    color: "var(--chart-1)",
    bg: "oklch(0.7 0.14 200 / 0.14)",
    icon: Plane,
  },
  hotel: {
    label: "Hotel",
    color: "var(--chart-5)",
    bg: "oklch(0.8 0.15 95 / 0.14)",
    icon: Hotel,
  },
  activity: {
    label: "Activity",
    color: "var(--chart-3)",
    bg: "oklch(0.72 0.16 40 / 0.14)",
    icon: MapPinned,
  },
  food: {
    label: "Food",
    color: "var(--accent)",
    bg: "oklch(0.78 0.11 155 / 0.14)",
    icon: UtensilsCrossed,
  },
  transfer: {
    label: "Transfer",
    color: "var(--chart-4)",
    bg: "oklch(0.77 0.12 260 / 0.14)",
    icon: Car,
  },
};

function formatMoney(amount: number): string {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
  return `INR ${safeAmount.toLocaleString("en-IN")}`;
}

function resolveDisplayCost(item: ItineraryItem): number {
  const value = Number(item.estimatedCost);
  if (Number.isFinite(value) && value > 0) return Math.round(value);
  if (item.type === "flight") return 6500;
  if (item.type === "hotel") return 3200;
  if (item.type === "food") return 700;
  if (item.type === "transfer") return 350;
  return 900;
}

function resolveBudgetRange(itinerary: SavedItinerary["itinerary"]): { min: number; max: number } {
  const directMin = Number(itinerary.budgetEstimate?.min);
  const directMax = Number(itinerary.budgetEstimate?.max);
  if (Number.isFinite(directMin) && directMin > 0 && Number.isFinite(directMax) && directMax >= directMin) {
    return { min: Math.round(directMin), max: Math.round(directMax) };
  }

  const itemTotal = itinerary.days
    .flatMap((day) => day.items)
    .reduce((sum, item) => sum + (Number.isFinite(Number(item.estimatedCost)) ? Math.max(0, Number(item.estimatedCost)) : 0), 0);
  const min = Math.max(8000, Math.round(itemTotal * 0.78));
  const max = Math.max(min + 3000, Math.round(itemTotal * 1.24));
  return { min, max };
}

function formatGeneratedAt(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

function ItineraryMissingState({ onBack }: { onBack: () => void }) {
  return (
    <div className="voyager-page-shell flex min-h-screen items-center justify-center px-4" style={{ background: "var(--background)" }}>
      <div
        className="voyager-glass-card w-full max-w-lg rounded-3xl px-6 py-6 text-center"
        style={{
          backdropFilter: "blur(18px)",
        }}
      >
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
          Itinerary not found
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
          Generate itinerary from the search page first, then this page will show the full visual plan.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="voyager-btn-primary mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Go back
        </button>
      </div>
    </div>
  );
}

export default function ItineraryPage() {
  const router = useRouter();
  const [saved, setSaved] = useState<SavedItinerary | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSaved(readItineraryFromSession());
    setReady(true);
  }, []);

  const backToSearch = () => {
    if (saved?.returnUrl) {
      router.push(saved.returnUrl);
      return;
    }
    router.push("/search");
  };

  const stats = useMemo(() => {
    if (!saved) return null;
    const itinerary = saved.itinerary;
    const budgetRange = resolveBudgetRange(itinerary);
    return [
      { label: "Total Days", value: String(itinerary.totalDays), icon: CalendarDays },
      {
        label: "Budget Range",
        value: `${formatMoney(budgetRange.min)} - ${formatMoney(budgetRange.max)}`,
        icon: IndianRupee,
      },
      { label: "Generated At", value: formatGeneratedAt(saved.generatedAt), icon: Clock3 },
    ];
  }, [saved]);

  if (!ready) {
    return (
      <div className="voyager-page-shell flex min-h-screen items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
          <Sparkles className="h-4 w-4 animate-pulse" />
          Loading itinerary...
        </div>
      </div>
    );
  }

  if (!saved) {
    return <ItineraryMissingState onBack={backToSearch} />;
  }

  const { itinerary, query } = saved;

  return (
    <div className="voyager-page-shell relative min-h-screen bg-[var(--background)]">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(180deg, oklch(0.11 0.02 240 / 0.1), transparent 35%), radial-gradient(circle at 20% 20%, oklch(0.75 0.14 190 / 0.12), transparent 42%), radial-gradient(circle at 78% 18%, oklch(0.78 0.11 155 / 0.12), transparent 45%)",
          }}
        />
      </div>

      <header
        className="sticky top-0 z-20 border-b px-5 py-4"
        style={{
          borderColor: "var(--glass-border)",
          background: "var(--surface-strong)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={backToSearch}
            className="voyager-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{ borderColor: "var(--glass-border)", background: "var(--glass)", color: "var(--foreground)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to results
          </button>

          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
            style={{
              borderColor: "var(--glass-border)",
              background: "var(--glass)",
              color: "var(--muted-foreground)",
            }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
            AI itinerary
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-5 py-6">
        <section
          className="voyager-glass-card overflow-hidden rounded-3xl"
          style={{ borderColor: "var(--glass-border)", background: "var(--surface-strong)" }}
        >
          <div
            className="h-64 w-full"
            style={{
              backgroundImage:
                "linear-gradient(180deg, transparent, oklch(0.1 0.02 242 / 0.85)), url('https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1800&q=80')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="space-y-2 px-6 py-6">
            <p className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--muted-foreground)" }}>
              {query || "Your trip"} itinerary
            </p>
            <h1 className="text-2xl font-bold md:text-3xl" style={{ color: "var(--foreground)" }}>
              {itinerary.title}
            </h1>
            <p className="max-w-3xl text-sm md:text-base" style={{ color: "var(--muted-foreground)" }}>
              {itinerary.summary}
            </p>
          </div>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-3">
          {stats?.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border p-4"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--surface-soft)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--glass)" }}>
                <stat.icon className="h-4 w-4" style={{ color: "var(--primary)" }} />
              </div>
              <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                {stat.label}
              </p>
              <p className="mt-1 text-sm font-semibold md:text-base" style={{ color: "var(--foreground)" }}>
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-6 space-y-5">
          {itinerary.days.map((day) => (
            <article
              key={day.day}
              className="rounded-2xl border p-4 md:p-5"
              style={{ borderColor: "var(--glass-border)", background: "var(--surface-strong)" }}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                    Day {day.day}
                  </p>
                  <h2 className="text-lg font-semibold md:text-xl" style={{ color: "var(--foreground)" }}>
                    {day.theme}
                  </h2>
                </div>
                <span
                  className="rounded-full border px-2.5 py-1 text-xs font-medium"
                  style={{ borderColor: "var(--glass-border)", background: "var(--glass)", color: "var(--foreground)" }}
                >
                  {day.items.length} stops
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {day.items.map((item, index) => {
                  const meta = ITEM_META[item.type] || ITEM_META.activity;
                  const Icon = meta.icon;
                  return (
                    <div
                      key={`${day.day}-${item.title}-${index}`}
                      className="rounded-xl border p-3"
                      style={{
                        borderColor: "var(--glass-border)",
                        background: "var(--surface-soft)",
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                        <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                          {item.time}
                        </span>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                        {item.description}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span style={{ color: "var(--foreground)" }}>
                          {formatMoney(resolveDisplayCost(item))}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5"
                          style={{
                            background: item.source === "results" ? "oklch(0.7 0.14 200 / 0.15)" : "var(--glass)",
                            color: "var(--muted-foreground)",
                          }}
                        >
                          {item.source}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-4 pb-4 md:grid-cols-2">
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: "var(--glass-border)", background: "var(--surface-strong)" }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--foreground)" }}>
              Packing Suggestions
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {itinerary.packingSuggestions.map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className="rounded-full border px-3 py-1 text-xs"
                  style={{
                    borderColor: "var(--glass-border)",
                    background: "var(--glass)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: "var(--glass-border)", background: "var(--surface-strong)" }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--foreground)" }}>
              Travel Tips
            </h3>
            <ul className="mt-3 space-y-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
              {itinerary.tips.map((tip, index) => (
                <li key={`${tip}-${index}`} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--glass-border)" }}>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
