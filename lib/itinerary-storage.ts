export type Pace = "Relaxed" | "Balanced" | "Packed";

export interface ItineraryItem {
  time: string;
  type: "flight" | "hotel" | "activity" | "food" | "transfer";
  title: string;
  description: string;
  estimatedCost: number;
  source: "results" | "suggested";
  sourceRef: string | null;
}

export interface ItineraryDay {
  day: number;
  theme: string;
  items: ItineraryItem[];
}

export interface ItineraryPayload {
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

export interface ItineraryPreferences {
  pace: Pace;
  days: number;
  budgetMin: number | null;
  budgetMax: number | null;
}

export interface SavedItinerary {
  itinerary: ItineraryPayload;
  query: string | null;
  generatedAt: string;
  returnUrl: string | null;
}

export const VOYAGER_ITINERARY_STORAGE_KEY = "voyager:lastItinerary";

export function extractItineraryPreferences(currentFilters: unknown): ItineraryPreferences {
  if (!currentFilters || typeof currentFilters !== "object") {
    return {
      pace: "Balanced",
      days: 3,
      budgetMin: null,
      budgetMax: null,
    };
  }

  const filters = currentFilters as Record<string, unknown>;

  const paceRaw = filters.tripPace;
  const pace: Pace =
    paceRaw === "Relaxed" || paceRaw === "Balanced" || paceRaw === "Packed"
      ? paceRaw
      : "Balanced";

  const durationDays = Array.isArray(filters.durationDays) ? (filters.durationDays as unknown[]) : [];
  const days =
    durationDays.length >= 2 && Number.isFinite(Number(durationDays[1]))
      ? Math.max(1, Number(durationDays[1]))
      : 3;

  const budget = Array.isArray(filters.budget) ? (filters.budget as unknown[]) : [];
  const budgetMin = budget.length >= 1 && Number.isFinite(Number(budget[0])) ? Number(budget[0]) : null;
  const budgetMax = budget.length >= 2 && Number.isFinite(Number(budget[1])) ? Number(budget[1]) : null;

  return {
    pace,
    days,
    budgetMin,
    budgetMax,
  };
}

export function saveItineraryToSession(payload: SavedItinerary): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(VOYAGER_ITINERARY_STORAGE_KEY, JSON.stringify(payload));
}

export function readItineraryFromSession(): SavedItinerary | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(VOYAGER_ITINERARY_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedItinerary;
    if (!parsed || typeof parsed !== "object" || !parsed.itinerary || typeof parsed.itinerary !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
