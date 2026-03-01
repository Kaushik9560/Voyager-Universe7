import { generateGeminiJson, isGeminiConfigured } from "@/lib/gemini";
import {
  parseQuery,
  type DestinationVibe,
  type ParsedQuery,
  type TravellerCategory,
  type TripPace,
} from "@/lib/query-parser";

interface AiQueryExtraction {
  from?: string | null;
  destination?: string | null;
  recommendedDestination?: string | null;
  recommendationReason?: string | null;
  usedRecommendation?: boolean | null;

  days?: number | null;
  checkIn?: string | null;
  checkOut?: string | null;
  adults?: number | null;
  children?: number | null;
  travellerType?: string | null;

  budgetMin?: number | null;
  budgetMax?: number | null;
  pace?: string | null;
  travelMonth?: number | null;
  vibes?: string[] | null;

  mustHave?: string[] | null;
  niceToHave?: string[] | null;
  exclusions?: string[] | null;
  clarifyingQuestions?: string[] | null;
}

const GEMINI_QUERY_SYSTEM_PROMPT = `
You are Voyager's Gemini-based trip intent extraction engine.

Input rule:
- User search text is passed as-is. Parse that exact text.

Goals:
1) Convert user query to structured travel intent JSON.
2) If destination is unclear OR user asks for help/recommendation, recommend a destination and set it as the final destination.
3) Assume missing fields sensibly so output is immediately usable.

Recommendation behavior:
- If you recommend, set "destination" and "recommendedDestination" to the same value, and set "usedRecommendation" = true.
- For emotional + devotional intent with modest budget (for example budget around INR 15,000), recommend practical devotional destinations in India (for example Varanasi, Haridwar, Rishikesh, Ujjain) based on budget/context.
- Keep outputs realistic for India unless user explicitly asks international travel.
- If source is not explicitly mentioned, set "from" to "Delhi".
- If destination is not explicit, recommend a destination different from source.

Assumption defaults when not specified:
- from: "Delhi"
- adults: 2
- children: 0
- days: 3
- checkIn/checkOut: null (timeline can be set by system)
- if one budget number appears, treat it as budgetMax

Output rules:
- Return ONLY strict JSON matching schema.
- No markdown, no extra text.
`.trim();

const GEMINI_QUERY_SCHEMA_HINT = `
{
  "from": string|null,
  "destination": string|null,
  "recommendedDestination": string|null,
  "recommendationReason": string|null,
  "usedRecommendation": boolean|null,
  "days": number|null,
  "checkIn": "YYYY-MM-DD"|null,
  "checkOut": "YYYY-MM-DD"|null,
  "adults": number|null,
  "children": number|null,
  "travellerType": "Solo"|"Couple"|"Family"|"Friends"|"Business"|null,
  "budgetMin": number|null,
  "budgetMax": number|null,
  "pace": "Relaxed"|"Balanced"|"Packed"|null,
  "travelMonth": number|null,
  "vibes": string[]|null,
  "mustHave": string[]|null,
  "niceToHave": string[]|null,
  "exclusions": string[]|null,
  "clarifyingQuestions": string[]|null
}
`.trim();

const CACHE_TTL_MS = 10 * 60 * 1000;
const QUERY_CACHE = new Map<string, { at: number; parsed: ParsedQuery }>();

const TRAVELLER_TYPES: TravellerCategory[] = ["Solo", "Couple", "Family", "Friends", "Business"];
const PACES: TripPace[] = ["Relaxed", "Balanced", "Packed"];
const VIBES: DestinationVibe[] = [
  "Beach",
  "Hills",
  "Desert",
  "City",
  "Forest",
  "Snow",
  "Backwaters",
  "Island",
];
const DEFAULT_SOURCE_CITY = "Delhi";

function isIsoDate(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw.trim());
}

function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dt = new Date(year || 1970, (month || 1) - 1, day || 1);
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayDiff(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00`);
  const b = new Date(`${checkOut}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function clampInt(raw: unknown, min: number, max: number): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function cleanText(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.replace(/\s+/g, " ").trim();
  return value || undefined;
}

function normalizeTravellerType(raw: unknown): TravellerCategory | undefined {
  if (typeof raw !== "string") return undefined;
  const match = TRAVELLER_TYPES.find((t) => t.toLowerCase() === raw.trim().toLowerCase());
  return match;
}

function normalizePace(raw: unknown): TripPace | undefined {
  if (typeof raw !== "string") return undefined;
  const match = PACES.find((p) => p.toLowerCase() === raw.trim().toLowerCase());
  return match;
}

function normalizeVibes(raw: unknown): DestinationVibe[] {
  if (!Array.isArray(raw)) return [];
  const out: DestinationVibe[] = [];

  for (const item of raw) {
    if (typeof item !== "string") continue;
    const value = item.trim().toLowerCase();
    let normalized: DestinationVibe | undefined;

    if (VIBES.find((v) => v.toLowerCase() === value)) {
      normalized = VIBES.find((v) => v.toLowerCase() === value);
    } else if (value.includes("coast")) {
      normalized = "Beach";
    } else if (value.includes("mountain")) {
      normalized = "Hills";
    } else if (value.includes("urban")) {
      normalized = "City";
    } else if (value.includes("nature")) {
      normalized = "Forest";
    } else if (value.includes("winter")) {
      normalized = "Snow";
    } else if (value.includes("lagoon")) {
      normalized = "Backwaters";
    }

    if (normalized && !out.includes(normalized)) out.push(normalized);
  }

  return out;
}

function normalizeStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function travellersLabel(adults: number, children: number, travellerType?: TravellerCategory): string {
  if (children > 0) {
    return `${adults} Adults · ${children} ${children === 1 ? "Child" : "Children"}`;
  }
  if (travellerType === "Couple" && adults === 2) return "Couple";
  if (travellerType === "Solo" && adults === 1) return "Solo";
  if (travellerType === "Family" && children > 0) return "Family";
  return adults === 1 ? "Solo" : `${adults} Adults`;
}

function normalizeBudgetRange(minRaw: unknown, maxRaw: unknown, fallback?: [number, number]): [number, number] | undefined {
  const min = clampInt(minRaw, 1000, 1_000_000);
  const max = clampInt(maxRaw, 1000, 1_000_000);

  if (min !== undefined && max !== undefined) {
    if (max >= min) return [min, max];
    return [max, min];
  }
  if (max !== undefined) {
    return [Math.min(5000, max), max];
  }
  if (min !== undefined) {
    return [min, Math.max(min, min * 2)];
  }

  return fallback;
}

function mergeInferredFilters(
  base: ParsedQuery["inferredFilters"],
  payload: {
    budgetRange?: [number, number];
    travellerType?: TravellerCategory;
    pace?: TripPace;
    month?: number;
    vibes: DestinationVibe[];
    mustHave: string[];
    exclusions: string[];
  }
): ParsedQuery["inferredFilters"] {
  const next: ParsedQuery["inferredFilters"] = {
    ...base,
  };

  if (payload.budgetRange) next.budget = payload.budgetRange;
  if (payload.travellerType) next.travellerTypes = [payload.travellerType];
  if (payload.pace) next.tripPace = payload.pace;
  if (payload.month) next.travelMonths = [payload.month];
  if (payload.vibes.length > 0) next.destinationVibes = payload.vibes;

  const hasDirectNeed =
    payload.mustHave.some((item) => /direct/i.test(item)) ||
    payload.exclusions.some((item) => /layover|stop/i.test(item));
  if (hasDirectNeed) {
    next.flights = { ...(next.flights || {}), directOnly: true };
  }

  const avoidRedEye = payload.exclusions.some((item) => /red[- ]?eye/i.test(item));
  if (avoidRedEye) {
    next.flights = { ...(next.flights || {}), redEye: false };
  }

  const breakfast = payload.mustHave.some((item) => /breakfast/i.test(item));
  if (breakfast) {
    next.stay = { ...(next.stay || {}), breakfastIncluded: true };
  }

  const refundable = payload.mustHave.some((item) => /refundable|free cancellation/i.test(item));
  if (refundable) {
    next.stay = { ...(next.stay || {}), refundable: true };
  }

  const honeymoon =
    payload.travellerType === "Couple" ||
    payload.mustHave.some((item) => /honeymoon/i.test(item));
  if (honeymoon) {
    next.special = { ...(next.special || {}), honeymoonSpecial: true };
  }

  return next;
}

function buildParsedQueryFromAi(
  query: string,
  base: ParsedQuery,
  llm: AiQueryExtraction
): ParsedQuery {
  const from = cleanText(llm.from) || base.from || DEFAULT_SOURCE_CITY;
  const fromLower = from.trim().toLowerCase();
  const recommendedDestination = cleanText(llm.recommendedDestination);
  let destination =
    cleanText(llm.destination) ||
    recommendedDestination ||
    base.destination ||
    base.to;

  if (destination && destination.trim().toLowerCase() === fromLower && !/\bstaycation\b/i.test(query)) {
    const alternatives = [recommendedDestination, cleanText(base.destination), cleanText(base.to)].filter(
      (value): value is string => Boolean(value)
    );
    const different = alternatives.find((value) => value.trim().toLowerCase() !== fromLower);
    destination = different;
  }

  const adults = clampInt(llm.adults, 1, 9) ?? base.adults;
  const children = clampInt(llm.children, 0, 6) ?? base.children;
  const travellerType = normalizeTravellerType(llm.travellerType) || base.travellerType;

  let days = clampInt(llm.days, 1, 30) ?? base.days ?? 3;
  let checkIn = isIsoDate(llm.checkIn) ? llm.checkIn : base.checkIn;
  let checkOut = isIsoDate(llm.checkOut) ? llm.checkOut : base.checkOut;

  if (isIsoDate(checkIn) && !isIsoDate(checkOut)) {
    checkOut = addDaysIso(checkIn, days);
  } else if (!isIsoDate(checkIn) && isIsoDate(checkOut)) {
    checkIn = addDaysIso(checkOut, -days);
  } else if (isIsoDate(checkIn) && isIsoDate(checkOut)) {
    const diff = dayDiff(checkIn, checkOut);
    if (diff > 0) {
      days = diff;
    } else {
      checkOut = addDaysIso(checkIn, days);
    }
  }

  const month = clampInt(llm.travelMonth, 1, 12) ?? base.month;
  const pace = normalizePace(llm.pace) || base.pace;
  const vibes = normalizeVibes(llm.vibes);
  const mustHave = normalizeStringList(llm.mustHave);
  const niceToHave = normalizeStringList(llm.niceToHave);
  const exclusions = normalizeStringList(llm.exclusions);
  const budgetRange = normalizeBudgetRange(llm.budgetMin, llm.budgetMax, base.budgetRange);

  const clarifyingFromLlm = normalizeStringList(llm.clarifyingQuestions).slice(0, 4);
  if (llm.usedRecommendation && recommendedDestination) {
    const prefix = `Recommended destination: ${recommendedDestination}.`;
    if (!clarifyingFromLlm.some((q) => q.toLowerCase().includes(recommendedDestination.toLowerCase()))) {
      clarifyingFromLlm.unshift(prefix);
    }
  }

  return {
    ...base,
    originalQuery: query,
    from,
    to: destination,
    destination,
    days,
    adults,
    children,
    travellersLabel: travellersLabel(adults, children, travellerType),
    travellerType,
    checkIn,
    checkOut,
    hasExplicitDuration: base.hasExplicitDuration || clampInt(llm.days, 1, 30) !== undefined,
    hasExplicitDates: base.hasExplicitDates || isIsoDate(llm.checkIn) || isIsoDate(llm.checkOut),
    budgetRange,
    pace,
    month,
    vibes: vibes.length > 0 ? vibes : base.vibes,
    prefs: {
      mustHave: mustHave.length > 0 ? mustHave : base.prefs.mustHave,
      niceToHave: niceToHave.length > 0 ? niceToHave : base.prefs.niceToHave,
      exclusions: exclusions.length > 0 ? exclusions : base.prefs.exclusions,
    },
    inferredFilters: mergeInferredFilters(base.inferredFilters, {
      budgetRange,
      travellerType,
      pace,
      month,
      vibes: vibes.length > 0 ? vibes : base.vibes || [],
      mustHave: mustHave.length > 0 ? mustHave : base.prefs.mustHave,
      exclusions: exclusions.length > 0 ? exclusions : base.prefs.exclusions,
    }),
    clarifyingQuestions: clarifyingFromLlm.length > 0 ? clarifyingFromLlm : base.clarifyingQuestions,
  };
}

function getCachedQuery(query: string): ParsedQuery | null {
  const key = query.trim().toLowerCase();
  const row = QUERY_CACHE.get(key);
  if (!row) return null;
  if (Date.now() - row.at > CACHE_TTL_MS) {
    QUERY_CACHE.delete(key);
    return null;
  }
  return row.parsed;
}

function setCachedQuery(query: string, parsed: ParsedQuery) {
  const key = query.trim().toLowerCase();
  QUERY_CACHE.set(key, { at: Date.now(), parsed });
}

export async function parseQueryWithGemini(query: string): Promise<ParsedQuery> {
  const rawQuery = String(query || "");
  const base = parseQuery(rawQuery);
  const cleanQuery = rawQuery.trim();
  if (!cleanQuery) return base;

  const cached = getCachedQuery(cleanQuery);
  if (cached) return cached;

  if (!isGeminiConfigured()) {
    setCachedQuery(cleanQuery, base);
    return base;
  }

  try {
    const llm = await generateGeminiJson<AiQueryExtraction>({
      systemPrompt: GEMINI_QUERY_SYSTEM_PROMPT,
      userPrompt: [
        "Extract trip intent from this exact user text and return strict JSON.",
        "User query (as-is):",
        rawQuery,
      ].join("\n"),
      schemaHint: GEMINI_QUERY_SCHEMA_HINT,
      temperature: 0.1,
      maxOutputTokens: 900,
    });

    if (!llm || typeof llm !== "object") {
      setCachedQuery(cleanQuery, base);
      return base;
    }

    const parsed = buildParsedQueryFromAi(rawQuery, base, llm);
    setCachedQuery(cleanQuery, parsed);
    return parsed;
  } catch {
    setCachedQuery(cleanQuery, base);
    return base;
  }
}

export const parseQueryWithAi = parseQueryWithGemini;
