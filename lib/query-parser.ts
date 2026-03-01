/**
 * Parse natural language travel queries into structured search params + inferred filters.
 * Example: "Budget 25k, 3 days, Delhi to Goa, avoid red-eye" -> structured intent.
 */

export type TravellerCategory = "Solo" | "Couple" | "Family" | "Friends" | "Business";
export type TripPace = "Relaxed" | "Balanced" | "Packed";
export type DestinationVibe =
  | "Beach"
  | "Hills"
  | "Desert"
  | "City"
  | "Forest"
  | "Snow"
  | "Backwaters"
  | "Island";

export interface ParsedQuery {
  from?: string;
  to?: string;
  destination?: string;
  days?: number;
  adults: number;
  children: number;
  travellersLabel: string;
  travellerType?: TravellerCategory;
  checkIn: string;
  checkOut: string;
  originalQuery: string;
  hasExplicitDuration: boolean;
  hasExplicitDates: boolean;

  budgetRange?: [number, number];
  pace?: TripPace;
  month?: number;
  vibes?: DestinationVibe[];

  prefs: {
    mustHave: string[];
    niceToHave: string[];
    exclusions: string[];
  };

  inferredFilters: {
    budget?: [number, number];
    travellerTypes?: TravellerCategory[];
    tripPace?: TripPace;
    travelMonths?: number[];
    destinationVibes?: DestinationVibe[];
    flights?: {
      directOnly?: boolean;
      redEye?: boolean;
    };
    stay?: {
      breakfastIncluded?: boolean;
      refundable?: boolean;
    };
    special?: {
      honeymoonSpecial?: boolean;
    };
  };

  clarifyingQuestions: string[];
}

const DEFAULT_SOURCE_CITY = "Delhi";

const KNOWN_CITIES: Record<string, string> = {
  delhi: "New Delhi",
  "new delhi": "New Delhi",
  mumbai: "Mumbai",
  goa: "Goa",
  bangalore: "Bangalore",
  bengaluru: "Bangalore",
  chennai: "Chennai",
  madras: "Chennai",
  kolkata: "Kolkata",
  hyderabad: "Hyderabad",
  manali: "Manali",
  shimla: "Shimla",
  jaipur: "Jaipur",
  udaipur: "Udaipur",
  kerala: "Kerala",
  kochi: "Kochi",
  agra: "Agra",
  varanasi: "Varanasi",
  kashmir: "Srinagar",
  srinagar: "Srinagar",
  punjab: "Amritsar",
  amritsar: "Amritsar",
  chandigarh: "Chandigarh",
  maldives: "Maldives",
  dubai: "Dubai",
  singapore: "Singapore",
  bangkok: "Bangkok",
  bali: "Bali",
  paris: "Paris",
  london: "London",
  "new york": "New York",
  rajasthan: "Jaipur",
};

const CITY_KEYWORDS = Object.keys(KNOWN_CITIES)
  .sort((a, b) => b.length - a.length)
  .map((city) => escapeRegExp(city));
const CITY_PATTERN = CITY_KEYWORDS.join("|");

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function capitalize(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanPlace(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveCity(raw: string): string | undefined {
  const cleaned = cleanPlace(raw);
  if (!cleaned) return undefined;
  return KNOWN_CITIES[cleaned] || capitalize(cleaned);
}

function toINR(value: number, unit?: string): number {
  const normalized = (unit || "").toLowerCase();
  if (normalized === "k" || normalized === "thousand") return Math.round(value * 1000);
  if (normalized === "l" || normalized === "lac" || normalized === "lakh") return Math.round(value * 100000);
  return Math.round(value);
}

function parseMoney(value: string, unit?: string): number {
  return toINR(Number(String(value).replace(/,/g, "")), unit);
}

function findCityMentions(query: string): Array<{ index: number; resolved: string }> {
  const lower = query.toLowerCase();
  const entries = Object.entries(KNOWN_CITIES).sort((a, b) => b[0].length - a[0].length);
  const rawHits: Array<{ start: number; end: number; resolved: string }> = [];

  for (const [key, resolved] of entries) {
    const rx = new RegExp(`\\b${escapeRegExp(key)}\\b`, "gi");
    let match: RegExpExecArray | null = null;
    while ((match = rx.exec(lower))) {
      rawHits.push({ start: match.index, end: match.index + match[0].length, resolved });
    }
  }

  rawHits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const merged: Array<{ index: number; resolved: string }> = [];
  let blockedUntil = -1;
  for (const hit of rawHits) {
    if (hit.start < blockedUntil) continue;
    merged.push({ index: hit.start, resolved: hit.resolved });
    blockedUntil = hit.end;
  }

  return merged;
}

function parseDestinations(query: string): { from?: string; to?: string } {
  const lower = query.toLowerCase();
  const breakWords =
    "(?:for|in|on|next|this|with|budget|under|within|around|about|near|during|in\\s+the|\\d+|couple|solo|family|friends|business|trip|vacation|holiday|honeymoon)";

  const fromTo = lower.match(new RegExp(`\\bfrom\\s+([a-z\\s]+?)\\s+to\\s+([a-z\\s]+?)(?=\\s+${breakWords}|$)`, "i"));
  if (fromTo) {
    return {
      from: resolveCity(fromTo[1]),
      to: resolveCity(fromTo[2]),
    };
  }

  const toFrom = lower.match(new RegExp(`\\bto\\s+([a-z\\s]+?)\\s+from\\s+([a-z\\s]+?)(?=\\s+${breakWords}|$)`, "i"));
  if (toFrom) {
    return {
      from: resolveCity(toFrom[2]),
      to: resolveCity(toFrom[1]),
    };
  }

  const arrow = lower.match(/\b([a-z\s]+?)\s*(?:->|→)\s*([a-z\s]+)\b/i);
  if (arrow) {
    return {
      from: resolveCity(arrow[1]),
      to: resolveCity(arrow[2]),
    };
  }

  const cityToCity = lower.match(new RegExp(`\\b(${CITY_PATTERN})\\b\\s*(?:to|->|→)\\s*\\b(${CITY_PATTERN})\\b`, "i"));
  if (cityToCity) {
    return {
      from: resolveCity(cityToCity[1]),
      to: resolveCity(cityToCity[2]),
    };
  }

  const fromOnly = lower.match(new RegExp(`\\bfrom\\s+([a-z\\s]+?)(?=\\s+${breakWords}|$)`, "i"));
  const toOnly = lower.match(new RegExp(`\\bto\\s+([a-z\\s]+?)(?=\\s+${breakWords}|$)`, "i"));
  if (toOnly || fromOnly) {
    if (toOnly && !fromOnly) {
      const mentions = findCityMentions(query);
      const resolvedTo = resolveCity(toOnly[1]);
      if (resolvedTo && mentions.length >= 2) {
        const fromMention = mentions.find((m) => m.resolved !== resolvedTo)?.resolved ?? mentions[0].resolved;
        return { from: fromMention, to: resolvedTo };
      }
    }
    return {
      from: fromOnly ? resolveCity(fromOnly[1]) : undefined,
      to: toOnly ? resolveCity(toOnly[1]) : undefined,
    };
  }

  const mentions = findCityMentions(query);
  if (mentions.length >= 2) {
    return { from: mentions[0].resolved, to: mentions[mentions.length - 1].resolved };
  }
  if (mentions.length === 1) {
    return { to: mentions[0].resolved };
  }

  return {};
}

function parseDuration(query: string): number | undefined {
  const range = query.match(/\b(\d+)\s*-\s*(\d+)\s*days?\b/i);
  if (range) return Number(range[1]);

  const daysShort = query.match(/\b(\d+)\s*d\b/i);
  if (daysShort) return Number(daysShort[1]);

  const single = query.match(/\b(\d+)\s*(?:days?|nights?)\b/i);
  if (single) return Number(single[1]);

  const weeks = query.match(/\b(\d+)\s*weeks?\b/i);
  if (weeks) return Number(weeks[1]) * 7;

  if (/\bweekend\b/i.test(query)) return 2;

  const oneDay = query.match(/\bone[-\s]?day\b/i);
  if (oneDay) return 1;

  return undefined;
}

function parseBudget(query: string): [number, number] | undefined {
  const amountPattern = "(\\d[\\d,]*(?:\\.\\d+)?)";
  const range = query.match(
    new RegExp(
      `\\b(?:budget|between|around)?\\s*₹?\\s*${amountPattern}\\s*(k|l|lac|lakh|thousand)?\\s*(?:-|to)\\s*₹?\\s*${amountPattern}\\s*(k|l|lac|lakh|thousand)?\\b`,
      "i"
    )
  );
  if (range) {
    const min = parseMoney(range[1], range[2]);
    const max = parseMoney(range[3], range[4]);
    if (max >= min) return [min, max];
  }

  const cap = query.match(
    new RegExp(`\\b(?:budget|under|upto|up to|max|within)\\s*₹?\\s*${amountPattern}\\s*(k|l|lac|lakh|thousand)?\\b`, "i")
  );
  if (cap) {
    const max = parseMoney(cap[1], cap[2]);
    return [5000, max];
  }

  const budgetOnly = query.match(
    new RegExp(`\\bbudget\\s*(?:is|around|about|of)?\\s*₹?\\s*${amountPattern}\\s*(k|l|lac|lakh|thousand)?\\b`, "i")
  );
  if (budgetOnly) {
    const max = parseMoney(budgetOnly[1], budgetOnly[2]);
    return [5000, max];
  }

  const bare = query.match(new RegExp(`\\b₹?\\s*${amountPattern}\\s*(k|l|lac|lakh|thousand)\\b`, "i"));
  if (bare) {
    const max = parseMoney(bare[1], bare[2]);
    return [5000, max];
  }

  return undefined;
}

function parseTravellers(query: string): {
  adults: number;
  children: number;
  label: string;
  travellerType?: TravellerCategory;
} {
  const explicitAdults = query.match(/\b(\d+)\s*adults?\b/i);
  const explicitChildren = query.match(/\b(\d+)\s*(children|child|kids?)\b/i);
  if (explicitAdults || explicitChildren) {
    const adults = Math.max(1, Number(explicitAdults?.[1] || "1"));
    const children = Math.max(0, Number(explicitChildren?.[1] || "0"));
    const label = children > 0 ? `${adults} Adults · ${children} Children` : `${adults} Adults`;
    const travellerType: TravellerCategory | undefined = children > 0 ? "Family" : adults === 1 ? "Solo" : undefined;
    return { adults, children, label, travellerType };
  }

  if (/\bhoneymoon\b/i.test(query) || /\bcouple\b/i.test(query)) {
    return { adults: 2, children: 0, label: "Couple", travellerType: "Couple" };
  }
  if (/\bsolo\b/i.test(query)) {
    return { adults: 1, children: 0, label: "Solo", travellerType: "Solo" };
  }
  if (/\bfamily\b/i.test(query)) {
    return { adults: 2, children: 2, label: "Family", travellerType: "Family" };
  }
  if (/\bfriends\b/i.test(query) || /\bgroup\b/i.test(query)) {
    return { adults: 4, children: 0, label: "Friends", travellerType: "Friends" };
  }
  if (/\bbusiness\b/i.test(query) || /\bwork trip\b/i.test(query)) {
    return { adults: 1, children: 0, label: "Business", travellerType: "Business" };
  }

  const numbered = query.match(/\b(\d+)\s*(people|persons|adults|travellers|travelers|pax)\b/i);
  if (numbered) {
    const adults = Math.max(1, Number(numbered[1]));
    return { adults, children: 0, label: `${adults} Adults` };
  }

  if (/\bwith kids?\b/i.test(query) || /\bwith child\b/i.test(query)) {
    return { adults: 2, children: 1, label: "Family", travellerType: "Family" };
  }

  return { adults: 2, children: 0, label: "2 Adults" };
}

function parseMonth(query: string): number | undefined {
  if (/\bnext month\b/i.test(query)) {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return next.getMonth() + 1;
  }

  if (/\bthis month\b/i.test(query)) {
    return new Date().getMonth() + 1;
  }

  const lower = query.toLowerCase();
  for (const [label, month] of Object.entries(MONTH_MAP)) {
    if (new RegExp(`\\b${label}\\b`, "i").test(lower)) {
      return month;
    }
  }
  return undefined;
}

function parsePace(query: string): TripPace | undefined {
  if (/\b(relaxed|slow|leisurely|chill)\b/i.test(query)) return "Relaxed";
  if (/\b(packed|hectic|full itinerary|fast[- ]?paced)\b/i.test(query)) return "Packed";
  if (/\b(balanced|moderate)\b/i.test(query)) return "Balanced";
  return undefined;
}

function parseVibes(query: string): DestinationVibe[] {
  const vibes: DestinationVibe[] = [];
  const lower = query.toLowerCase();
  if (/\bbeach|coast|seaside\b/.test(lower)) vibes.push("Beach");
  if (/\bhill|mountain\b/.test(lower)) vibes.push("Hills");
  if (/\bdesert\b/.test(lower)) vibes.push("Desert");
  if (/\bcity|urban\b/.test(lower)) vibes.push("City");
  if (/\bforest|jungle\b/.test(lower)) vibes.push("Forest");
  if (/\bsnow|ski\b/.test(lower)) vibes.push("Snow");
  if (/\bbackwater\b/.test(lower)) vibes.push("Backwaters");
  if (/\bisland\b/.test(lower)) vibes.push("Island");
  return vibes;
}

function parsePreferences(query: string) {
  const mustHave: string[] = [];
  const niceToHave: string[] = [];
  const exclusions: string[] = [];

  if (/\bbreakfast\b/i.test(query)) mustHave.push("Breakfast included");
  if (/\brefundable|free cancellation\b/i.test(query)) mustHave.push("Refundable booking");
  if (/\bdirect\b/i.test(query)) mustHave.push("Direct flights");
  if (/\bveg|vegetarian\b/i.test(query)) mustHave.push("Veg-friendly dining");

  if (/\badventure\b/i.test(query)) niceToHave.push("Adventure activities");
  if (/\bcafe|cafes\b/i.test(query)) niceToHave.push("Cafe recommendations");
  if (/\bnightlife\b/i.test(query)) niceToHave.push("Nightlife");

  if (/\bavoid red[- ]?eye\b/i.test(query)) exclusions.push("Avoid red-eye flights");
  if (/\bavoid layover|avoid stop\b/i.test(query)) exclusions.push("Avoid layovers");
  if (/\bavoid overnight\b/i.test(query)) exclusions.push("Avoid overnight travel");
  if (/\blow walking|less walking|minimal walking\b/i.test(query)) exclusions.push("Low walking routes");

  return { mustHave, niceToHave, exclusions };
}

function daysUntilMonth(month: number): number {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const targetYear = month >= currentMonth ? now.getFullYear() : now.getFullYear() + 1;
  const targetDate = new Date(targetYear, month - 1, 1);
  const diffMs = targetDate.getTime() - now.getTime();
  return Math.max(7, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildDateRange(checkIn: Date, durationDays: number): { checkIn: string; checkOut: string } {
  const duration = Math.max(1, durationDays);
  const checkOut = addDays(checkIn, duration);
  return { checkIn: fmtDate(checkIn), checkOut: fmtDate(checkOut) };
}

function createDate(day: number, month: number, year?: number): Date | null {
  const now = new Date();
  let y = year ?? now.getFullYear();

  const candidate = new Date(y, month - 1, day);
  if (candidate.getMonth() !== month - 1 || candidate.getDate() !== day) {
    return null;
  }

  if (!year) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (candidate < today) {
      y += 1;
      const nextYearCandidate = new Date(y, month - 1, day);
      if (nextYearCandidate.getMonth() !== month - 1 || nextYearCandidate.getDate() !== day) {
        return null;
      }
      return nextYearCandidate;
    }
  }

  return candidate;
}

function parseExplicitDates(query: string): Date[] {
  const dates: Date[] = [];

  const isoRx = /\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g;
  let m: RegExpExecArray | null = null;
  while ((m = isoRx.exec(query))) {
    const d = createDate(Number(m[3]), Number(m[2]), Number(m[1]));
    if (d) dates.push(d);
  }

  const dmyRx = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/g;
  while ((m = dmyRx.exec(query))) {
    const first = Number(m[1]);
    const second = Number(m[2]);
    const year = m[3] ? Number(m[3]) : undefined;
    const isLikelyDMY = second <= 12;
    const day = isLikelyDMY ? first : second;
    const month = isLikelyDMY ? second : first;
    const d = createDate(day, month, year);
    if (d) dates.push(d);
  }

  const monthNames = Object.keys(MONTH_MAP).sort((a, b) => b.length - a.length).join("|");
  const textual1 = new RegExp(`\\b(\\d{1,2})\\s+(${monthNames})(?:\\s+(20\\d{2}))?\\b`, "gi");
  while ((m = textual1.exec(query))) {
    const month = MONTH_MAP[m[2].toLowerCase()];
    const d = createDate(Number(m[1]), month, m[3] ? Number(m[3]) : undefined);
    if (d) dates.push(d);
  }

  const textual2 = new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:\\s*,?\\s*(20\\d{2}))?\\b`, "gi");
  while ((m = textual2.exec(query))) {
    const month = MONTH_MAP[m[1].toLowerCase()];
    const d = createDate(Number(m[2]), month, m[3] ? Number(m[3]) : undefined);
    if (d) dates.push(d);
  }

  dates.sort((a, b) => a.getTime() - b.getTime());
  const deduped: Date[] = [];
  const seen = new Set<string>();
  for (const d of dates) {
    const key = fmtDate(d);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(d);
  }
  return deduped;
}

function getWeekendStart(now: Date, nextWeek = false): Date {
  const current = new Date(now);
  const day = current.getDay(); // Sun=0
  const daysUntilSaturday = (6 - day + 7) % 7;
  const offset = daysUntilSaturday + (nextWeek || daysUntilSaturday === 0 ? 7 : 0);
  return addDays(current, offset);
}

function getTimelineDates(query: string, durationDays: number, month?: number): { checkIn: string; checkOut: string } {
  const explicit = parseExplicitDates(query);
  if (explicit.length >= 2) {
    return { checkIn: fmtDate(explicit[0]), checkOut: fmtDate(explicit[1]) };
  }
  if (explicit.length === 1) {
    return buildDateRange(explicit[0], durationDays);
  }

  const now = new Date();
  if (/\bday after tomorrow\b/i.test(query)) {
    return buildDateRange(addDays(now, 2), durationDays);
  }
  if (/\btomorrow\b/i.test(query)) {
    return buildDateRange(addDays(now, 1), durationDays);
  }
  if (/\bnext weekend\b/i.test(query)) {
    return buildDateRange(getWeekendStart(now, true), durationDays || 2);
  }
  if (/\bthis weekend\b/i.test(query) || /\bweekend getaway\b/i.test(query)) {
    return buildDateRange(getWeekendStart(now, false), durationDays || 2);
  }
  const inDays = query.match(/\b(?:in|after)\s+(\d+)\s*days?\b/i);
  if (inDays) {
    return buildDateRange(addDays(now, Number(inDays[1])), durationDays);
  }
  if (/\bnext week\b/i.test(query)) {
    const day = now.getDay();
    const daysUntilNextMonday = ((8 - day) % 7) || 7;
    return buildDateRange(addDays(now, daysUntilNextMonday), durationDays);
  }

  return getFutureDates(durationDays, month);
}

function getFutureDates(durationDays: number, month?: number): { checkIn: string; checkOut: string } {
  const daysFromNow = month ? daysUntilMonth(month) : 7;
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + daysFromNow);
  return buildDateRange(checkIn, durationDays);
}

function buildClarifyingQuestions(args: {
  from?: string;
  to?: string;
  parsedDays?: number;
  hasExplicitDates: boolean;
  budgetRange?: [number, number];
}): string[] {
  const questions: string[] = [];

  if (!args.to) questions.push("Which destination would you like to plan for?");
  if (!args.hasExplicitDates) questions.push("What start and end dates should we use?");
  if (!args.parsedDays) questions.push("How many days should this trip be?");
  if (!args.budgetRange) questions.push("What is your approximate budget per person?");
  if (!args.from && args.to) questions.push("Which city will you travel from?");

  return questions.slice(0, 4);
}

export function parseQuery(query: string): ParsedQuery {
  const destinations = parseDestinations(query);
  const resolvedFrom = destinations.from || DEFAULT_SOURCE_CITY;
  const resolvedTo = destinations.to;
  const parsedDays = parseDuration(query);
  const days = parsedDays ?? 3;
  const budgetRange = parseBudget(query);
  const travellerInfo = parseTravellers(query);
  const month = parseMonth(query);
  const pace = parsePace(query);
  const vibes = parseVibes(query);
  const prefs = parsePreferences(query);
  const { checkIn, checkOut } = getTimelineDates(query, days, month);
  const hasExplicitDuration = parsedDays !== undefined;
  const timelineMentioned =
    /\b(tomorrow|day after tomorrow|weekend|next week|next month|this month|in\s+\d+\s+days?)\b/i.test(query) ||
    /\b\d{1,2}[/-]\d{1,2}(?:[/-]20\d{2})?\b/.test(query) ||
    /\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/.test(query);
  const hasExplicitDates = parseExplicitDates(query).length > 0 || timelineMentioned;
  const monthForOutput = month ?? (timelineMentioned ? Number(checkIn.split("-")[1]) : undefined);

  const inferredFilters: ParsedQuery["inferredFilters"] = {};

  if (budgetRange) inferredFilters.budget = budgetRange;
  if (travellerInfo.travellerType) inferredFilters.travellerTypes = [travellerInfo.travellerType];
  if (pace) inferredFilters.tripPace = pace;
  if (monthForOutput) inferredFilters.travelMonths = [monthForOutput];
  if (vibes.length > 0) inferredFilters.destinationVibes = vibes;

  if (prefs.mustHave.includes("Direct flights") || prefs.exclusions.includes("Avoid layovers")) {
    inferredFilters.flights = { ...(inferredFilters.flights || {}), directOnly: true };
  }
  if (prefs.exclusions.includes("Avoid red-eye flights")) {
    inferredFilters.flights = { ...(inferredFilters.flights || {}), redEye: false };
  }
  if (prefs.mustHave.includes("Breakfast included") || /\bbreakfast\b/i.test(query)) {
    inferredFilters.stay = { ...(inferredFilters.stay || {}), breakfastIncluded: true };
  }
  if (prefs.mustHave.includes("Refundable booking")) {
    inferredFilters.stay = { ...(inferredFilters.stay || {}), refundable: true };
  }
  if (/\bhoneymoon\b/i.test(query)) {
    inferredFilters.special = { ...(inferredFilters.special || {}), honeymoonSpecial: true };
  }

  return {
    from: resolvedFrom,
    to: resolvedTo,
    destination: resolvedTo,
    days,
    adults: travellerInfo.adults,
    children: travellerInfo.children,
    travellersLabel: travellerInfo.label,
    travellerType: travellerInfo.travellerType,
    checkIn,
    checkOut,
    originalQuery: query,
    hasExplicitDuration,
    hasExplicitDates,
    budgetRange,
    pace,
    month: monthForOutput,
    vibes: vibes.length > 0 ? vibes : undefined,
    prefs,
    inferredFilters,
    clarifyingQuestions: buildClarifyingQuestions({
      from: resolvedFrom,
      to: resolvedTo,
      parsedDays,
      hasExplicitDates,
      budgetRange,
    }),
  };
}
