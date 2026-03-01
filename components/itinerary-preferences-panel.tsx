"use client";

import type { CSSProperties } from "react";
import { HeartHandshake, Sparkles } from "lucide-react";
import type { Pace } from "@/lib/itinerary-storage";

export interface ItineraryInputAnswers {
  pacePreference: Pace | "Auto";
  tripFocus: "Adventure" | "Relaxation" | "Culture" | "Family Fun" | "Mixed";
  foodPreference: "Veg only" | "Mixed" | "Street + Local" | "Multi-cuisine";
  mobilityPreference: "Comfort first" | "Budget smart" | "Balanced";
  withKids: boolean;
  withSeniors: boolean;
  specialRequest: string;
  healthNotes: string;
}

interface ItineraryPreferencesPanelProps {
  value: ItineraryInputAnswers;
  onChange: (next: ItineraryInputAnswers) => void;
}

const focusOptions: ItineraryInputAnswers["tripFocus"][] = [
  "Adventure",
  "Relaxation",
  "Culture",
  "Family Fun",
  "Mixed",
];

const foodOptions: ItineraryInputAnswers["foodPreference"][] = [
  "Veg only",
  "Mixed",
  "Street + Local",
  "Multi-cuisine",
];

const mobilityOptions: ItineraryInputAnswers["mobilityPreference"][] = [
  "Comfort first",
  "Budget smart",
  "Balanced",
];

const paceOptions: Array<ItineraryInputAnswers["pacePreference"]> = ["Auto", "Relaxed", "Balanced", "Packed"];

const fieldStyle: CSSProperties = {
  borderColor: "var(--glass-border)",
  background: "color-mix(in oklch, var(--card) 84%, white 16%)",
  color: "var(--foreground)",
};

function chipStyle(active: boolean): CSSProperties {
  if (active) {
    return {
      borderColor: "color-mix(in oklch, var(--primary) 62%, white 38%)",
      background: "color-mix(in oklch, var(--primary) 20%, transparent)",
      color: "var(--foreground)",
      boxShadow: "0 12px 24px oklch(0.16 0.03 240 / 0.14)",
    };
  }

  return {
    borderColor: "var(--glass-border)",
    background: "color-mix(in oklch, var(--surface-soft) 80%, white 20%)",
    color: "var(--muted-foreground)",
  };
}

function CheckRow({
  checked,
  onChange,
  text,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  text: string;
}) {
  return (
    <label
      className="voyager-soft-card group flex items-center gap-3 rounded-2xl px-4 py-3.5 text-base transition duration-300 hover:-translate-y-0.5 hover:shadow-lg"
      style={
        checked
          ? {
              borderColor: "color-mix(in oklch, var(--primary) 58%, white 42%)",
              background: "color-mix(in oklch, var(--primary) 16%, transparent)",
              color: "var(--foreground)",
            }
          : {
              color: "var(--foreground)",
            }
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 shrink-0 cursor-pointer rounded-md border-[1.5px] shadow-sm transition duration-300 focus-visible:outline-none"
        style={{
          borderColor: "var(--glass-border)",
          background: "var(--card)",
          accentColor: "var(--primary)",
        }}
      />
      {text}
    </label>
  );
}

function ChipGroup<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: T[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="voyager-soft-card voyager-hover-lift rounded-2xl p-4">
      <p
        className="voyager-badge mb-3 text-[11px] uppercase tracking-[0.16em]"
        style={{ color: "var(--muted-foreground)" }}
      >
        {title}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className="rounded-full border px-4 py-1.5 text-xs font-semibold tracking-[0.01em] transition duration-300 hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-md"
              style={chipStyle(active)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ItineraryPreferencesPanel({ value, onChange }: ItineraryPreferencesPanelProps) {
  const update = <K extends keyof ItineraryInputAnswers>(key: K, next: ItineraryInputAnswers[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <section
      className="voyager-glass-card relative mt-6 overflow-hidden rounded-2xl p-6 transition duration-300 md:p-8"
      style={{
        boxShadow: "0 24px 50px oklch(0.2 0.03 240 / 0.14), inset 0 1px 0 oklch(1 0 0 / 0.62)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: "color-mix(in oklch, var(--chart-1) 28%, transparent)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -right-12 h-56 w-56 rounded-full blur-3xl"
        style={{ background: "color-mix(in oklch, var(--chart-3) 24%, transparent)" }}
      />

      <div className="relative mb-8 flex items-start gap-4">
        <div
          className="inline-flex h-12 w-12 items-center justify-center rounded-full border shadow-md"
          style={{
            borderColor: "var(--glass-border)",
            background: "color-mix(in oklch, var(--primary) 14%, transparent)",
            color: "var(--primary)",
          }}
        >
          <HeartHandshake className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-[1.6rem] font-semibold leading-tight tracking-tight md:text-[1.9rem]" style={{ color: "var(--foreground)" }}>
            Before We Generate Your Itinerary
          </h3>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            Help AI with a few extra preferences for better recommendations.
          </p>
        </div>
      </div>

      <div className="relative grid gap-6 lg:grid-cols-2">
        <ChipGroup
          title="Trip Pace"
          options={paceOptions}
          value={value.pacePreference}
          onChange={(next) => update("pacePreference", next)}
        />

        <ChipGroup
          title="Trip Focus"
          options={focusOptions}
          value={value.tripFocus}
          onChange={(next) => update("tripFocus", next)}
        />

        <ChipGroup
          title="Food Style"
          options={foodOptions}
          value={value.foodPreference}
          onChange={(next) => update("foodPreference", next)}
        />

        <ChipGroup
          title="Mobility Preference"
          options={mobilityOptions}
          value={value.mobilityPreference}
          onChange={(next) => update("mobilityPreference", next)}
        />
      </div>

      <div className="relative mt-7 grid gap-4 md:grid-cols-2">
        <CheckRow
          checked={value.withKids}
          onChange={(next) => update("withKids", next)}
          text="Include kid-friendly pacing and stops"
        />
        <CheckRow
          checked={value.withSeniors}
          onChange={(next) => update("withSeniors", next)}
          text="Include senior-friendly movement buffers"
        />
      </div>

      <div className="relative mt-7 grid gap-4 lg:grid-cols-2">
        <label className="block">
          <p className="voyager-badge mb-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
            Health / medicine notes
          </p>
          <textarea
            value={value.healthNotes}
            onChange={(event) => update("healthNotes", event.target.value)}
            placeholder="Any allergies, motion sickness, weather sensitivity..."
            className="voyager-input min-h-[120px] rounded-2xl px-4 py-3 text-sm leading-relaxed placeholder:opacity-70"
            style={{
              ...fieldStyle,
              boxShadow: "inset 0 1px 4px oklch(0.2 0.02 240 / 0.1), 0 8px 18px oklch(0.2 0.02 240 / 0.05)",
            }}
          />
        </label>

        <label className="block">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="voyager-badge text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Special request for AI planner
            </p>
            <button
              type="button"
              onClick={() => update("specialRequest", "I leave that to your imagination.")}
              className="voyager-btn-secondary inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition duration-300 hover:-translate-y-0.5 hover:scale-[1.03]"
              style={{ color: "var(--foreground)" }}
            >
              <Sparkles className="h-3 w-3" />
              Auto creative
            </button>
          </div>
          <textarea
            value={value.specialRequest}
            onChange={(event) => update("specialRequest", event.target.value)}
            placeholder="Example: I leave that to your imagination..."
            className="voyager-input min-h-[120px] rounded-2xl px-4 py-3 text-sm leading-relaxed placeholder:opacity-70"
            style={{
              ...fieldStyle,
              boxShadow: "inset 0 1px 4px oklch(0.2 0.02 240 / 0.1), 0 8px 18px oklch(0.2 0.02 240 / 0.05)",
            }}
          />
        </label>
      </div>
    </section>
  );
}
