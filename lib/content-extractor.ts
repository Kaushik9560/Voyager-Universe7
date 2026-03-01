import type { ParsedQuery } from "@/lib/query-parser";

export type ConstraintType = "hard" | "soft" | "optimize" | null;

export interface ExtractedInterest {
  type: string;
  constraintType: "hard" | "soft";
  confidence: number;
  source: "query" | "parsed";
}

export interface ExtractedBudgetIntent {
  max: number | null;
  constraintType: ConstraintType;
}

export interface ExtractedConnectivityIntent {
  value: "nearMetro" | "publicTransport" | "walkable" | null;
  constraintType: "hard" | "soft" | null;
}

export interface ContentExtractionResult {
  destination: string | null;
  durationDays: number;
  month: number | null;
  budget: ExtractedBudgetIntent;
  connectivity: ExtractedConnectivityIntent;
  interests: ExtractedInterest[];
  moodTags: string[];
  keywords: string[];
  summary: string[];
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "please",
  "plan",
  "to",
  "trip",
  "travel",
  "want",
  "we",
  "with",
]);

const INTEREST_PATTERNS: Array<{ type: string; mood?: string; rx: RegExp }> = [
  { type: "peaceful", mood: "calm", rx: /\b(peaceful|calm|relax|chill|slow|detox)\b/i },
  { type: "adventure", mood: "thrill", rx: /\b(adventure|thrill|trek|hike|rafting|extreme)\b/i },
  { type: "romantic", mood: "romantic", rx: /\b(romantic|honeymoon|couple|date)\b/i },
  { type: "beach", mood: "coastal", rx: /\b(beach|coast|sea|island)\b/i },
  { type: "nightlife", mood: "party", rx: /\b(party|nightlife|club|pub)\b/i },
  { type: "spiritual", mood: "spiritual", rx: /\b(spiritual|temple|religious|pilgrimage)\b/i },
  { type: "nature", mood: "nature", rx: /\b(nature|forest|wildlife|mountain|hills)\b/i },
  { type: "culture", mood: "culture", rx: /\b(culture|heritage|history|museum)\b/i },
  { type: "food", mood: "foodie", rx: /\b(food|dining|street food|cuisine|restaurant)\b/i },
  { type: "shopping", mood: "city", rx: /\b(shopping|market|bazaar)\b/i },
];

function inferBudgetConstraintType(query: string): ConstraintType {
  if (/\b(cheapest|cheaper|save|value|optimi[sz]e|best deal)\b/i.test(query)) return "optimize";
  if (/\b(strict|hard cap|under|within|max(?:imum)?|not more than)\b/i.test(query)) return "hard";
  if (/\b(around|about|approx|approximately|near)\b/i.test(query)) return "soft";
  return null;
}

function inferConnectivity(query: string): ExtractedConnectivityIntent {
  if (/\b(near metro|metro access|close to metro)\b/i.test(query)) {
    return {
      value: "nearMetro",
      constraintType: /\b(must|strict|required|mandatory)\b/i.test(query) ? "hard" : "soft",
    };
  }
  if (/\b(public transport|bus connectivity|well connected)\b/i.test(query)) {
    return { value: "publicTransport", constraintType: "soft" };
  }
  if (/\b(walkable|walking distance)\b/i.test(query)) {
    return { value: "walkable", constraintType: "soft" };
  }
  return { value: null, constraintType: null };
}

function extractInterests(query: string, parsed: ParsedQuery): { interests: ExtractedInterest[]; moodTags: string[] } {
  const interests: ExtractedInterest[] = [];
  const moodTags: string[] = [];

  for (const row of INTEREST_PATTERNS) {
    if (!row.rx.test(query)) continue;
    interests.push({
      type: row.type,
      constraintType: "soft",
      confidence: 0.8,
      source: "query",
    });
    if (row.mood) moodTags.push(row.mood);
  }

  for (const vibe of parsed.vibes || []) {
    const type = vibe.toLowerCase();
    if (interests.some((i) => i.type === type)) continue;
    interests.push({
      type,
      constraintType: "soft",
      confidence: 0.65,
      source: "parsed",
    });
  }

  if (parsed.travellerType === "Couple" && !interests.some((i) => i.type === "romantic")) {
    interests.push({
      type: "romantic",
      constraintType: "soft",
      confidence: 0.6,
      source: "parsed",
    });
  }

  return { interests, moodTags: Array.from(new Set(moodTags)) };
}

function extractKeywords(query: string): string[] {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  return Array.from(new Set(words)).slice(0, 10);
}

function buildSummary(payload: {
  destination: string | null;
  durationDays: number;
  budget: ExtractedBudgetIntent;
  interests: ExtractedInterest[];
  connectivity: ExtractedConnectivityIntent;
}): string[] {
  const lines: string[] = [];
  lines.push(payload.destination ? `Destination: ${payload.destination}` : "Destination: not explicit");
  lines.push(`Duration: ${payload.durationDays} day(s)`);
  if (payload.budget.max) {
    const ctype = payload.budget.constraintType ? ` (${payload.budget.constraintType})` : "";
    lines.push(`Budget cap: INR ${payload.budget.max}${ctype}`);
  }
  if (payload.connectivity.value) {
    lines.push(`Connectivity: ${payload.connectivity.value}`);
  }
  if (payload.interests.length > 0) {
    lines.push(`Interests: ${payload.interests.map((i) => i.type).join(", ")}`);
  }
  return lines;
}

export function extractContentIntent(query: string, parsed: ParsedQuery): ContentExtractionResult {
  const budgetMax = parsed.budgetRange?.[1] ?? null;
  const budget: ExtractedBudgetIntent = {
    max: budgetMax,
    constraintType: inferBudgetConstraintType(query),
  };
  const connectivity = inferConnectivity(query);
  const { interests, moodTags } = extractInterests(query, parsed);

  const result: ContentExtractionResult = {
    destination: parsed.destination || parsed.to || null,
    durationDays: Math.max(1, parsed.days || 3),
    month: parsed.month ?? null,
    budget,
    connectivity,
    interests,
    moodTags,
    keywords: extractKeywords(query),
    summary: [],
  };
  result.summary = buildSummary({
    destination: result.destination,
    durationDays: result.durationDays,
    budget: result.budget,
    interests: result.interests,
    connectivity: result.connectivity,
  });
  return result;
}
