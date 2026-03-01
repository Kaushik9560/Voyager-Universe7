import { NextResponse } from "next/server";
import { generateAiJson, isAiConfigured } from "@/lib/ai";

type Pace = "Relaxed" | "Balanced" | "Packed";

interface ItineraryContextPayload {
  currentQuery: string | null;
  currentFilters: Record<string, unknown> | null;
  resultsSummary: Record<string, unknown> | null;
}

interface ItineraryRequestBody {
  context: ItineraryContextPayload;
  preferences: {
    pace: Pace | null;
    days: number | null;
    budgetMin: number | null;
    budgetMax: number | null;
  };
}

type ItineraryItemType = "flight" | "hotel" | "activity" | "food" | "transfer";
type ItinerarySource = "results" | "suggested";

interface ItineraryItem {
  time: string;
  type: ItineraryItemType;
  title: string;
  description: string;
  estimatedCost: number;
  source: ItinerarySource;
  sourceRef: string | null;
}

interface ItineraryDay {
  day: number;
  theme: string;
  items: ItineraryItem[];
}

interface ItineraryResponseBody {
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

interface ResultsSummaryLike {
  flights?: Array<{
    airline?: string;
    flightCode?: string;
    from?: string;
    to?: string;
    departure?: string;
    arrival?: string;
    price?: number;
  }>;
  hotels?: Array<{
    hotelName?: string;
    price?: number;
    address?: string;
  }>;
  activities?: Array<{
    title?: string;
    area?: string | null;
    price?: number;
  }>;
  restaurants?: Array<{
    title?: string;
    cuisine?: string;
    area?: string;
  }>;
}

const ITINERARY_SYSTEM_PROMPT = `
You are Voyager itinerary planner.
Return ONLY valid JSON matching this exact schema:
{
  "title": string,
  "summary": string,
  "totalDays": number,
  "days": [
    {
      "day": number,
      "theme": string,
      "items": [
        {
          "time": string,
          "type": "flight"|"hotel"|"activity"|"food"|"transfer",
          "title": string,
          "description": string,
          "estimatedCost": number,
          "source": "results"|"suggested",
          "sourceRef": string|null
        }
      ]
    }
  ],
  "budgetEstimate": { "min": number, "max": number, "currency": string },
  "packingSuggestions": string[],
  "tips": string[]
}

Rules:
1) Output ONLY JSON and ensure strict validity.
2) Use resultsSummary heavily. Prefer source="results" whenever matching data exists.
3) If gaps exist, add realistic fillers with source="suggested".
4) Keep schedule realistic by time and geography.
4.1) If context contains itineraryInputs or predictiveInsights, use them as high-priority personalization hints.
5) Pace to items/day:
   - Relaxed: 3-4
   - Balanced: 4-6
   - Packed: 6-8
6) All monetary values must be in INR and must be positive integers (no zero/negative budgets).
7) Do not leak secrets or internal values.
`.trim();

const ITINERARY_SCHEMA_HINT = `
title:string
summary:string
totalDays:number
days:[{day:number,theme:string,items:[{time,type,title,description,estimatedCost,source,sourceRef}]}]
budgetEstimate:{min:number,max:number,currency:string}
packingSuggestions:string[]
tips:string[]
`.trim();

const VALID_ITEM_TYPES: ItineraryItemType[] = ["flight", "hotel", "activity", "food", "transfer"];
const DEFAULT_ITEM_COST_INR: Record<ItineraryItemType, number> = {
  flight: 6500,
  hotel: 3200,
  activity: 900,
  food: 700,
  transfer: 350,
};

const DAY_THEME_POOL = [
  "Cultural landmarks and city stories",
  "Nature trails and scenic corners",
  "Local flavors and cafe hopping",
  "Leisure experiences and shopping",
  "Hidden gems and sunset moments",
];

const SUGGESTED_STOP_POOL: Array<{
  time: string;
  type: ItineraryItemType;
  title: string;
  description: string;
}> = [
  {
    time: "09:00",
    type: "activity",
    title: "Heritage district walk",
    description: "Explore historical streets and iconic architecture with flexible pacing.",
  },
  {
    time: "11:30",
    type: "activity",
    title: "Scenic viewpoint trail",
    description: "Visit a popular viewpoint and nearby photo-friendly spots.",
  },
  {
    time: "13:15",
    type: "food",
    title: "Local cuisine lunch",
    description: "Try regional specialties at a well-rated local restaurant.",
  },
  {
    time: "16:00",
    type: "activity",
    title: "Museum and culture stop",
    description: "Spend time at a museum, gallery, or cultural center.",
  },
  {
    time: "18:20",
    type: "activity",
    title: "Sunset leisure break",
    description: "Relax at a park, promenade, or lakefront during sunset.",
  },
  {
    time: "20:00",
    type: "food",
    title: "Signature dinner experience",
    description: "Reserve a comfortable dinner slot for local favorites.",
  },
  {
    time: "21:30",
    type: "transfer",
    title: "Hotel transfer and wind down",
    description: "Return to stay with buffer time for rest.",
  },
];

function normalizeItemType(raw: unknown): ItineraryItemType {
  if (typeof raw !== "string") return "activity";
  return VALID_ITEM_TYPES.includes(raw as ItineraryItemType) ? (raw as ItineraryItemType) : "activity";
}

function normalizeSource(raw: unknown): ItinerarySource {
  return raw === "results" ? "results" : "suggested";
}

function normalizeStringArray(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback;
  const values = raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? values : fallback;
}

function normalizeEstimatedCost(raw: unknown, type: ItineraryItemType): number {
  const value = Number(raw);
  if (Number.isFinite(value) && value > 0) return Math.round(value);
  return DEFAULT_ITEM_COST_INR[type];
}

function fallbackTheme(dayNumber: number, totalDays: number): string {
  if (dayNumber === 1) return "Arrival and orientation";
  if (dayNumber === totalDays) return "Wrap-up and departure prep";
  return DAY_THEME_POOL[(dayNumber - 2 + DAY_THEME_POOL.length) % DAY_THEME_POOL.length];
}

function pickSuggestedStop(dayIndex: number, itemIndex: number): ItineraryItem {
  const template = SUGGESTED_STOP_POOL[(dayIndex * 2 + itemIndex) % SUGGESTED_STOP_POOL.length];
  return {
    time: template.time,
    type: template.type,
    title: template.title,
    description: template.description,
    estimatedCost: DEFAULT_ITEM_COST_INR[template.type],
    source: "suggested",
    sourceRef: null,
  };
}

function buildFallbackDay(dayNumber: number, totalDays: number): ItineraryDay {
  const dayIndex = Math.max(0, dayNumber - 1);
  const items = [pickSuggestedStop(dayIndex, 0), pickSuggestedStop(dayIndex, 1), pickSuggestedStop(dayIndex, 2)];

  if (dayNumber === 1) {
    items[0] = {
      time: "08:30",
      type: "transfer",
      title: "Arrival transfer and check-in prep",
      description: "Transfer from arrival point to hotel zone and settle in comfortably.",
      estimatedCost: DEFAULT_ITEM_COST_INR.transfer,
      source: "suggested",
      sourceRef: null,
    };
  }

  if (dayNumber === totalDays) {
    items[items.length - 1] = {
      time: "18:00",
      type: "activity",
      title: "Souvenir walk and trip wrap-up",
      description: "Keep a relaxed slot for final shopping and departure planning.",
      estimatedCost: DEFAULT_ITEM_COST_INR.activity,
      source: "suggested",
      sourceRef: null,
    };
  }

  return {
    day: dayNumber,
    theme: fallbackTheme(dayNumber, totalDays),
    items,
  };
}

function normalizeResponse(raw: unknown, requestedDays: number): ItineraryResponseBody {
  const fallbackDays = Array.from({ length: requestedDays }).map((_, index) =>
    buildFallbackDay(index + 1, requestedDays)
  );
  const fallback: ItineraryResponseBody = {
    title: "Suggested Trip Itinerary",
    summary: "Here is a practical day-wise itinerary based on your latest search context.",
    totalDays: requestedDays,
    days: fallbackDays,
    budgetEstimate: {
      min: 10000,
      max: 30000,
      currency: "INR",
    },
    packingSuggestions: ["Comfortable shoes", "Weather-appropriate clothing", "Power bank"],
    tips: ["Keep buffer time for transfers", "Confirm booking timings one day prior"],
  };

  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;

  const normalizedDaysRaw = Array.isArray(obj.days) ? obj.days : [];
  const normalizedDaysFromModel: ItineraryDay[] = normalizedDaysRaw
    .map((dayItem, dayIndex) => {
      if (!dayItem || typeof dayItem !== "object") return null;
      const dayObj = dayItem as Record<string, unknown>;
      const itemsRaw = Array.isArray(dayObj.items) ? dayObj.items : [];

      const items: ItineraryItem[] = itemsRaw
        .map((item, itemIndex) => {
          if (!item || typeof item !== "object") return null;
          const entry = item as Record<string, unknown>;
          const type = normalizeItemType(entry.type);
          return {
            time: typeof entry.time === "string" && entry.time.trim() ? entry.time.trim() : `${9 + itemIndex}:00`,
            type,
            title: typeof entry.title === "string" && entry.title.trim() ? entry.title.trim() : "Planned stop",
            description:
              typeof entry.description === "string" && entry.description.trim()
                ? entry.description.trim()
                : "Planned based on your travel preferences.",
            estimatedCost: normalizeEstimatedCost(entry.estimatedCost, type),
            source: normalizeSource(entry.source),
            sourceRef: typeof entry.sourceRef === "string" && entry.sourceRef.trim() ? entry.sourceRef.trim() : null,
          };
        })
        .filter((item): item is ItineraryItem => Boolean(item));

      return {
        day: Number.isFinite(Number(dayObj.day)) ? Number(dayObj.day) : dayIndex + 1,
        theme:
          typeof dayObj.theme === "string" && dayObj.theme.trim()
            ? dayObj.theme.trim()
            : fallbackTheme(dayIndex + 1, requestedDays),
        items: items.length ? items : buildFallbackDay(dayIndex + 1, requestedDays).items,
      };
    })
    .filter((day): day is ItineraryDay => Boolean(day));

  const totalDays = Number.isFinite(Number(obj.totalDays))
    ? Math.max(1, Number(obj.totalDays))
    : normalizedDaysFromModel.length || requestedDays;

  const normalizedDays: ItineraryDay[] = (normalizedDaysFromModel.length ? normalizedDaysFromModel : fallbackDays)
    .slice(0, totalDays)
    .map((day, index) => ({
      ...day,
      day: index + 1,
      theme: day.theme?.trim() || fallbackTheme(index + 1, totalDays),
      items:
        Array.isArray(day.items) && day.items.length
          ? day.items
          : buildFallbackDay(index + 1, totalDays).items,
    }));

  while (normalizedDays.length < totalDays) {
    normalizedDays.push(buildFallbackDay(normalizedDays.length + 1, totalDays));
  }

  const genericTitlePattern = /^(local exploration|planned stop|city highlights|sightseeing)$/i;
  const usedSuggestedTitles = new Set<string>();
  const usedThemes = new Set<string>();

  const deDuplicatedDays = normalizedDays.map((day, dayIndex) => {
    const themeKey = day.theme.trim().toLowerCase();
    const genericTheme = /^day\s*\d+/i.test(day.theme) || /(highlights|local experiences)/i.test(day.theme);
    const nextTheme =
      !themeKey || genericTheme || usedThemes.has(themeKey)
        ? fallbackTheme(dayIndex + 1, totalDays)
        : day.theme.trim();
    usedThemes.add(nextTheme.toLowerCase());

    const items = day.items.map((item, itemIndex) => {
      const normalizedTitle = item.title.trim();
      const titleKey = normalizedTitle.toLowerCase();
      const isGenericTitle = genericTitlePattern.test(normalizedTitle);
      const duplicateSuggested = item.source === "suggested" && usedSuggestedTitles.has(titleKey);
      const fill = pickSuggestedStop(dayIndex, itemIndex);
      const type = normalizeItemType(item.type);

      if (item.source === "suggested" && (isGenericTitle || duplicateSuggested)) {
        usedSuggestedTitles.add(fill.title.toLowerCase());
        return {
          ...item,
          type: fill.type,
          title: fill.title,
          description: fill.description,
          time: item.time || fill.time,
          estimatedCost: normalizeEstimatedCost(item.estimatedCost, fill.type),
          sourceRef: null,
        };
      }

      usedSuggestedTitles.add(titleKey);
      return {
        ...item,
        type,
        estimatedCost: normalizeEstimatedCost(item.estimatedCost, type),
      };
    });

    return {
      ...day,
      day: dayIndex + 1,
      theme: nextTheme,
      items,
    };
  });

  const budget = obj.budgetEstimate as Record<string, unknown> | undefined;
  const budgetFromItems = deDuplicatedDays
    .flatMap((day) => day.items)
    .reduce((sum, item) => sum + normalizeEstimatedCost(item.estimatedCost, item.type), 0);
  const computedBudgetMin = Math.max(8000, Math.round(budgetFromItems * 0.78));
  const computedBudgetMax = Math.max(computedBudgetMin + 3000, Math.round(budgetFromItems * 1.24));

  const rawBudgetMin = Number(budget?.min);
  const rawBudgetMax = Number(budget?.max);
  const minBudget = Number.isFinite(rawBudgetMin) && rawBudgetMin > 0 ? Math.round(rawBudgetMin) : computedBudgetMin;
  const maxBudget =
    Number.isFinite(rawBudgetMax) && rawBudgetMax >= minBudget
      ? Math.round(rawBudgetMax)
      : Math.max(minBudget + 3000, computedBudgetMax);

  return {
    title: typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : fallback.title,
    summary: typeof obj.summary === "string" && obj.summary.trim() ? obj.summary.trim() : fallback.summary,
    totalDays,
    days: deDuplicatedDays.length ? deDuplicatedDays : fallback.days,
    budgetEstimate: {
      min: minBudget,
      max: maxBudget,
      currency: "INR",
    },
    packingSuggestions: normalizeStringArray(obj.packingSuggestions, fallback.packingSuggestions),
    tips: normalizeStringArray(obj.tips, fallback.tips),
  };
}

function paceItemRange(pace: Pace | null | undefined) {
  if (pace === "Relaxed") return { min: 3, max: 4 };
  if (pace === "Packed") return { min: 6, max: 8 };
  return { min: 4, max: 6 };
}

function buildFallbackFromContext(
  context: ItineraryContextPayload,
  preferences: ItineraryRequestBody["preferences"],
  reason: string
): ItineraryResponseBody {
  const totalDays = Number.isFinite(Number(preferences.days)) ? Math.max(1, Number(preferences.days)) : 3;
  const pace = preferences.pace ?? "Balanced";
  const { min: minItems, max: maxItems } = paceItemRange(pace);
  const perDay = Math.floor((minItems + maxItems) / 2);

  const summary = (context.resultsSummary || {}) as ResultsSummaryLike;
  const flights = summary.flights || [];
  const hotels = summary.hotels || [];
  const activities = summary.activities || [];
  const restaurants = summary.restaurants || [];

  const leadFlight = flights[0];
  const leadHotel = hotels[0];

  let activityIndex = 0;
  let restaurantIndex = 0;
  const days: ItineraryDay[] = [];

  for (let day = 1; day <= totalDays; day += 1) {
    const items: ItineraryItem[] = [];

    if (day === 1 && leadFlight) {
      items.push({
        time: leadFlight.departure || "07:30",
        type: "flight",
        title: `${leadFlight.airline || "Flight"} ${leadFlight.flightCode || ""}`.trim(),
        description: `${leadFlight.from || "Origin"} to ${leadFlight.to || "Destination"} flight.`,
        estimatedCost: normalizeEstimatedCost(leadFlight.price, "flight"),
        source: "results",
        sourceRef: leadFlight.flightCode || null,
      });
    }

    if (day === 1 && leadHotel) {
      items.push({
        time: "14:00",
        type: "hotel",
        title: leadHotel.hotelName || "Hotel check-in",
        description: `Check in and settle down${leadHotel.address ? ` near ${leadHotel.address}` : ""}.`,
        estimatedCost: normalizeEstimatedCost(leadHotel.price, "hotel"),
        source: "results",
        sourceRef: leadHotel.hotelName || null,
      });
    }

    while (items.length < perDay) {
      if (activities.length > 0 && activityIndex < activities.length) {
        const activity = activities[activityIndex % activities.length];
        items.push({
          time: `${10 + (items.length % 5)}:00`,
          type: "activity",
          title: activity.title || "Local activity",
          description: activity.area
            ? `Explore ${activity.area} and nearby highlights.`
            : "Explore key local attractions at a comfortable pace.",
          estimatedCost: normalizeEstimatedCost(activity.price || 1000, "activity"),
          source: "results",
          sourceRef: activity.title || null,
        });
        activityIndex += 1;
        continue;
      }

      if (restaurants.length > 0 && restaurantIndex < restaurants.length) {
        const restaurant = restaurants[restaurantIndex % restaurants.length];
        items.push({
          time: items.length < 2 ? "13:00" : "20:00",
          type: "food",
          title: restaurant.title || "Dining stop",
          description: `${restaurant.cuisine || "Local cuisine"} dining${
            restaurant.area ? ` in ${restaurant.area}` : ""
          }.`,
          estimatedCost: normalizeEstimatedCost(800, "food"),
          source: "results",
          sourceRef: restaurant.title || null,
        });
        restaurantIndex += 1;
        continue;
      }

      items.push(pickSuggestedStop(day - 1, items.length));
    }

    days.push({
      day,
      theme: fallbackTheme(day, totalDays),
      items: items.slice(0, maxItems),
    });
  }

  const estimated = days.flatMap((day) => day.items).reduce((sum, item) => sum + item.estimatedCost, 0);
  const budgetMin = Number.isFinite(Number(preferences.budgetMin))
    ? Number(preferences.budgetMin)
    : Math.max(8000, Math.round(estimated * 0.8));
  const budgetMax = Number.isFinite(Number(preferences.budgetMax))
    ? Number(preferences.budgetMax)
    : Math.max(budgetMin + 3000, Math.round(estimated * 1.2));

  const queryText = context.currentQuery?.trim() || "your selected route";

  return {
    title: `Day-wise itinerary for ${queryText}`,
    summary: `Generated from your current context. Fallback planner used (${reason}).`,
    totalDays,
    days,
    budgetEstimate: {
      min: Math.max(8000, Math.round(budgetMin)),
      max: Math.max(Math.round(budgetMin) + 2500, Math.round(budgetMax)),
      currency: "INR",
    },
    packingSuggestions: ["Comfortable walking shoes", "Reusable water bottle", "Power bank", "ID documents"],
    tips: [
      "Keep 20-30 min transfer buffer between activities.",
      "Confirm opening hours one day before.",
      "Reserve a flexible meal slot for local recommendations.",
    ],
  };
}

export async function POST(request: Request) {
  let context: ItineraryContextPayload = {
    currentQuery: null,
    currentFilters: null,
    resultsSummary: null,
  };
  let preferences: ItineraryRequestBody["preferences"] = {
    pace: "Balanced",
    days: 3,
    budgetMin: null,
    budgetMax: null,
  };

  try {
    const body = (await request.json()) as ItineraryRequestBody;
    context = body?.context || context;
    preferences = body?.preferences || preferences;

    if (!isAiConfigured()) {
      return NextResponse.json(
        buildFallbackFromContext(context, preferences, "AI_NOT_CONFIGURED"),
        { status: 200 }
      );
    }

    const days = Number.isFinite(Number(preferences.days)) ? Math.max(1, Number(preferences.days)) : 3;

    const userPrompt = [
      "Context JSON:",
      JSON.stringify(context, null, 2),
      "",
      "Preferences JSON:",
      JSON.stringify(preferences, null, 2),
      "",
      "Generate realistic day-wise itinerary JSON only.",
    ].join("\n");

    const modelResponse = await generateAiJson<ItineraryResponseBody>({
      systemPrompt: ITINERARY_SYSTEM_PROMPT,
      userPrompt,
      schemaHint: ITINERARY_SCHEMA_HINT,
      temperature: 0.2,
      maxOutputTokens: 2600,
    });

    const normalized = normalizeResponse(modelResponse, days);
    return NextResponse.json(normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(buildFallbackFromContext(context, preferences, message), { status: 200 });
  }
}
