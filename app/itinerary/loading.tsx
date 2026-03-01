import { Sparkles } from "lucide-react";

export default function ItineraryLoading() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(160deg, oklch(0.15 0.03 245), oklch(0.18 0.03 210)), url('https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "saturate(1.05)",
        }}
      />
      <div className="absolute inset-0" style={{ background: "oklch(0.08 0.01 260 / 0.5)", backdropFilter: "blur(8px)" }} />

      <div
        className="relative w-full max-w-md rounded-3xl border px-6 py-7 text-center"
        style={{
          borderColor: "var(--glass-border)",
          background: "var(--surface-strong)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--glass)" }}>
          <Sparkles className="h-6 w-6 animate-pulse" style={{ color: "var(--primary)" }} />
        </div>
        <p className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
          Preparing your visual itinerary
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
          Collecting recommendations and arranging your day-wise plan.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <span className="h-2.5 w-2.5 animate-bounce rounded-full" style={{ background: "var(--primary)" }} />
          <span
            className="h-2.5 w-2.5 animate-bounce rounded-full"
            style={{ background: "var(--accent)", animationDelay: "120ms" }}
          />
          <span
            className="h-2.5 w-2.5 animate-bounce rounded-full"
            style={{ background: "var(--chart-5)", animationDelay: "240ms" }}
          />
        </div>
      </div>
    </div>
  );
}
