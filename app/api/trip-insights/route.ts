import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type {
  CategorizedPlace,
  FoodPlaceSummary,
  PlaceCategories,
  TripInsightsPayload,
  WeatherTrend,
  WeatherTrendDay,
} from "@/lib/trip-insights";

interface ActivityInput {
  name?: string;
  category?: string;
  description?: string;
  rating?: number;
  price?: number;
}

interface RestaurantInput {
  name?: string;
  cuisine?: string;
  location?: string;
  rating?: number;
  priceRange?: string;
  veg?: boolean;
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
    stops?: string;
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

interface TripInsightsRequestBody {
  context: {
    currentQuery?: string | null;
    from?: string | null;
    to?: string | null;
    checkIn?: string | null;
    resultsSummary?: ResultsSummaryLike | null;
    activities?: ActivityInput[];
    restaurants?: RestaurantInput[];
  };
}

interface GeocodeResponse {
  results?: Array<{
    latitude: number;
    longitude: number;
    name: string;
    country?: string;
  }>;
}

interface ForecastResponse {
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    weather_code?: number[];
  };
}

function sanitizeCityName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\bto\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/[,|]/g, " ")
    .trim();
}

function parseDestinationFromQuery(query: string | null | undefined): string {
  const text = (query || "").trim();
  if (!text) return "";
  const match = text.match(/\bto\s+([a-zA-Z\s]+)/i);
  if (!match?.[1]) return text;
  return sanitizeCityName(match[1].split("for")[0] || match[1]);
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseStartDate(raw: string | null | undefined): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(`${raw}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const now = new Date();
  now.setDate(now.getDate() + 1);
  return now;
}

function daySummaryFromWeatherCode(code: number): string {
  if ([0, 1].includes(code)) return "Mostly clear";
  if ([2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Light rain";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Showers";
  if ([95, 96, 99].includes(code)) return "Stormy";
  return "Mixed weather";
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveWeather(destination: string): Promise<WeatherTrend> {
  const fallback = buildFallbackWeatherTrend(destination);
  if (!destination) return fallback;

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      destination
    )}&count=1&language=en&format=json`;
    const geo = await fetchJsonWithTimeout<GeocodeResponse>(geoUrl, 4200);
    const top = geo.results?.[0];
    if (!top) return fallback;

    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${top.latitude}&longitude=${top.longitude}` +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code" +
      "&forecast_days=7&timezone=auto";

    const forecast = await fetchJsonWithTimeout<ForecastResponse>(forecastUrl, 4500);
    const daily = forecast.daily;
    if (
      !daily?.time ||
      !daily.temperature_2m_max ||
      !daily.temperature_2m_min ||
      !daily.precipitation_probability_max ||
      !daily.weather_code
    ) {
      return fallback;
    }

    const days: WeatherTrendDay[] = daily.time.slice(0, 7).map((date, index) => ({
      date,
      maxTemp: Math.round(Number(daily.temperature_2m_max?.[index] ?? 0)),
      minTemp: Math.round(Number(daily.temperature_2m_min?.[index] ?? 0)),
      precipitationChance: Math.round(Number(daily.precipitation_probability_max?.[index] ?? 0)),
      summary: daySummaryFromWeatherCode(Number(daily.weather_code?.[index] ?? 1)),
    }));

    return buildWeatherSummary(destination, days);
  } catch {
    return fallback;
  }
}

function buildFallbackWeatherTrend(destination: string): WeatherTrend {
  const now = new Date();
  const month = now.getMonth() + 1;
  const warmSeason = month >= 3 && month <= 8;
  const rainySeason = month >= 6 && month <= 9;

  const days: WeatherTrendDay[] = Array.from({ length: 7 }).map((_, index) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + index);
    const baseMax = warmSeason ? 33 : 25;
    const baseMin = warmSeason ? 24 : 17;
    const variation = index % 3 === 0 ? 1 : index % 2 === 0 ? 0 : -1;
    return {
      date: toIsoDate(dt),
      maxTemp: baseMax + variation,
      minTemp: baseMin + variation,
      precipitationChance: rainySeason ? 58 - index * 2 : 22 + index,
      summary: rainySeason ? "Possible showers" : warmSeason ? "Warm and sunny" : "Pleasant weather",
    };
  });

  return buildWeatherSummary(destination, days);
}

function buildWeatherSummary(destination: string, days: WeatherTrendDay[]): WeatherTrend {
  const avgMax = Math.round(days.reduce((sum, day) => sum + day.maxTemp, 0) / Math.max(1, days.length));
  const avgMin = Math.round(days.reduce((sum, day) => sum + day.minTemp, 0) / Math.max(1, days.length));
  const avgRain = Math.round(
    days.reduce((sum, day) => sum + day.precipitationChance, 0) / Math.max(1, days.length)
  );

  let climateTag = "Pleasant";
  if (avgMax >= 34) climateTag = "Hot";
  else if (avgMax <= 17) climateTag = "Cold";
  if (avgRain >= 55) climateTag = `${climateTag} + Rain-prone`;

  const summary = `${destination || "Destination"}: next 7 days around ${avgMin}-${avgMax} C with ${avgRain}% average rain chance.`;
  return {
    destination: destination || "Destination",
    climateTag,
    summary,
    days,
  };
}

function getFlightBasePrice(summary: ResultsSummaryLike | null | undefined): number {
  const prices = (summary?.flights || [])
    .map((row) => Number(row.price || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (prices.length === 0) return 6200;
  return Math.min(...prices);
}

function forecastSeries(base: number, startDate: Date, volatility: number, drift: number) {
  return Array.from({ length: 7 }).map((_, index) => {
    const dt = new Date(startDate);
    dt.setDate(startDate.getDate() + index);
    const day = dt.getDay();
    const weekendMultiplier = day === 5 || day === 6 ? 1.08 : 1;
    const wave = 1 + Math.sin((index + 1) / 2.1) * volatility;
    const trend = 1 + index * drift;
    return {
      date: toIsoDate(dt),
      price: Math.max(400, Math.round(base * weekendMultiplier * wave * trend)),
    };
  });
}

function outlookFromSeries(points: Array<{ price: number }>): string {
  if (points.length < 2) return "Likely stable";
  const first = points[0].price;
  const last = points[points.length - 1].price;
  if (last >= first * 1.08) return "Likely to rise";
  if (last <= first * 0.92) return "Likely to soften";
  return "Likely stable";
}

function parseArea(text: string | undefined, fallback: string): string {
  if (!text) return fallback;
  const nearMatch = text.match(/near:\s*([^,]+)/i);
  if (nearMatch?.[1]) return nearMatch[1].trim();
  return text.split(",")[0]?.trim() || fallback;
}

function normalizeActivities(
  rawActivities: ActivityInput[] | undefined,
  summary: ResultsSummaryLike | null | undefined,
  destination: string
): Array<CategorizedPlace & { rating: number }> {
  const fromRaw = (rawActivities || []).map((activity) => ({
    title: activity.name || "Attraction",
    area: parseArea(activity.description, destination || "City Center"),
    reason: activity.category || "General activity",
    estimatedCost: Number.isFinite(Number(activity.price)) ? Number(activity.price) : null,
    rating: Number.isFinite(Number(activity.rating)) ? Number(activity.rating) : 4.2,
  }));

  const fromSummary = (summary?.activities || []).map((activity) => ({
    title: activity.title || "Attraction",
    area: activity.area || destination || "City Center",
    reason: "Popular local activity",
    estimatedCost: Number.isFinite(Number(activity.price)) ? Number(activity.price) : null,
    rating: 4.3,
  }));

  const merged = [...fromRaw, ...fromSummary];
  const seen = new Set<string>();
  return merged.filter((row) => {
    const key = row.title.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickByKeywords(
  rows: Array<CategorizedPlace & { rating: number }>,
  keywords: string[]
): CategorizedPlace[] {
  return rows
    .filter((row) => {
      const text = `${row.title} ${row.reason} ${row.area}`.toLowerCase();
      return keywords.some((keyword) => text.includes(keyword));
    })
    .slice(0, 5)
    .map((row) => ({
      title: row.title,
      area: row.area,
      reason: row.reason,
      estimatedCost: row.estimatedCost,
    }));
}

function withFallbackPlaces(rows: CategorizedPlace[], destination: string, labels: string[]) {
  if (rows.length) return rows;
  return labels.map((label, index) => ({
    title: `${destination || "Destination"} ${label}`,
    area: destination || "City Center",
    reason: `Recommended ${label.toLowerCase()} spot for balanced itinerary.`,
    estimatedCost: index % 2 === 0 ? 800 : 1200,
  }));
}

function buildPlaceCategories(
  rawActivities: ActivityInput[] | undefined,
  summary: ResultsSummaryLike | null | undefined,
  destination: string
): PlaceCategories {
  const rows = normalizeActivities(rawActivities, summary, destination);

  const adventure = withFallbackPlaces(
    pickByKeywords(rows, ["adventure", "kayak", "rafting", "safari", "zip", "climb", "water sport"]),
    destination,
    ["Adventure Hub", "Outdoor Experience"]
  );
  const trek = withFallbackPlaces(
    pickByKeywords(rows, ["trek", "hike", "trail", "mountain", "fort walk"]),
    destination,
    ["Trek Route", "Nature Trail"]
  );
  const sunriseSunset = withFallbackPlaces(
    pickByKeywords(rows, ["sunrise", "sunset", "view", "point", "beach", "lake"]),
    destination,
    ["Sunrise Point", "Sunset View Deck"]
  );
  const kidFriendly = withFallbackPlaces(
    pickByKeywords(rows, ["zoo", "park", "aquarium", "museum", "kids", "theme"]),
    destination,
    ["Family Park", "Interactive Museum"]
  );
  const shopping = withFallbackPlaces(
    pickByKeywords(rows, ["market", "shopping", "bazaar", "mall", "street"]),
    destination,
    ["Main Market", "Local Shopping Street"]
  );

  const activity = withFallbackPlaces(
    rows.slice(0, 6).map((row) => ({
      title: row.title,
      area: row.area,
      reason: row.reason,
      estimatedCost: row.estimatedCost,
    })),
    destination,
    ["Top Activity", "Local Experience"]
  );

  const allRound = withFallbackPlaces(
    [...rows]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 6)
      .map((row) => ({
        title: row.title,
        area: row.area,
        reason: row.reason,
        estimatedCost: row.estimatedCost,
      })),
    destination,
    ["All-round Highlight", "City Signature Spot"]
  );

  return {
    adventure,
    trek,
    sunriseSunset,
    activity,
    kidFriendly,
    shopping,
    allRound,
  };
}

function priceFromRange(range: string | undefined): number {
  if (!range) return 1200;
  if (range.includes("$$$")) return 2600;
  if (range.includes("$$")) return 1400;
  return 650;
}

function buildFoodGuide(
  rawRestaurants: RestaurantInput[] | undefined,
  summary: ResultsSummaryLike | null | undefined,
  destination: string
) {
  const fromRaw: FoodPlaceSummary[] = (rawRestaurants || []).map((restaurant) => ({
    name: restaurant.name || "Restaurant",
    cuisine: restaurant.cuisine || "Local / Multi-cuisine",
    area: parseArea(restaurant.location, destination || "City Center"),
    priceEstimate: priceFromRange(restaurant.priceRange),
    vegOnly: Boolean(restaurant.veg) || /veg|vegetarian|jain/i.test(String(restaurant.cuisine || "")),
    rating: Number.isFinite(Number(restaurant.rating)) ? Number(restaurant.rating) : 4.2,
  }));

  const fromSummary: FoodPlaceSummary[] = (summary?.restaurants || []).map((restaurant) => ({
    name: restaurant.title || "Restaurant",
    cuisine: restaurant.cuisine || "Local / Multi-cuisine",
    area: restaurant.area || destination || "City Center",
    priceEstimate: 1200,
    vegOnly: /veg|vegetarian|jain/i.test(String(restaurant.cuisine || "")),
    rating: 4.2,
  }));

  const merged = [...fromRaw, ...fromSummary]
    .filter((row) => row.name.trim())
    .sort((a, b) => a.priceEstimate - b.priceEstimate);

  const seen = new Set<string>();
  const unique = merged.filter((row) => {
    const key = row.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const vegOnly = unique.filter((row) => row.vegOnly).slice(0, 8);
  const multiCuisine = unique
    .filter((row) => /multi|indian|asian|continental|cafe|fusion/i.test(row.cuisine) || !row.vegOnly)
    .slice(0, 8);

  return {
    vegOnly:
      vegOnly.length > 0
        ? vegOnly
        : [
            {
              name: `${destination || "Destination"} Pure Veg House`,
              cuisine: "Vegetarian",
              area: destination || "City Center",
              priceEstimate: 700,
              vegOnly: true,
              rating: 4.2,
            },
          ],
    multiCuisine:
      multiCuisine.length > 0
        ? multiCuisine
        : [
            {
              name: `${destination || "Destination"} Multi-Cuisine Kitchen`,
              cuisine: "Indian / Multi-cuisine",
              area: destination || "City Center",
              priceEstimate: 1300,
              vegOnly: false,
              rating: 4.3,
            },
          ],
    note: "Sorted approximately by expected per-person price.",
  };
}

function buildMedicalKit(climateTag: string, weather: WeatherTrend) {
  const avgMax = Math.round(
    weather.days.reduce((sum, day) => sum + day.maxTemp, 0) / Math.max(1, weather.days.length)
  );
  const avgRain = Math.round(
    weather.days.reduce((sum, day) => sum + day.precipitationChance, 0) / Math.max(1, weather.days.length)
  );

  const mustCarry = ["Band-aids", "Antiseptic cream", "Pain relief tablet", "Hand sanitizer", "Motion sickness tablet"];
  const optional: string[] = ["Digital thermometer", "Prescription medicines", "Electrolyte sachets (ORS)"];
  const caution: string[] = ["If any chronic condition exists, carry doctor-prescribed medication and recent prescription."];

  if (avgMax >= 32) {
    mustCarry.push("ORS / electrolyte powder", "Anti-vomiting tablet", "Sunscreen SPF 50");
    optional.push("Cooling wipes", "Cap / UV sleeves");
    caution.push("Hydrate every 60-90 minutes and avoid direct afternoon sun exposure.");
  }

  if (avgMax <= 18) {
    mustCarry.push("Paracetamol (PCM)", "Cold/cough tablets", "Throat lozenges");
    optional.push("Steam inhalation capsule", "Thermal wear");
    caution.push("Layer clothing and keep evenings warm to avoid sudden temperature drops.");
  }

  if (avgRain >= 55 || climateTag.toLowerCase().includes("rain")) {
    mustCarry.push("Mosquito repellent", "Anti-fungal powder", "Waterproof bandages");
    optional.push("Quick-dry socks", "Rain cover for medicines");
    caution.push("Keep medicine pouch dry and avoid untreated street water/ice.");
  }

  return {
    climateTag,
    mustCarry: Array.from(new Set(mustCarry)),
    optional: Array.from(new Set(optional)),
    caution: Array.from(new Set(caution)),
  };
}

export async function POST(request: NextRequest) {
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as TripInsightsRequestBody;
    const context = body?.context || {};

    const destination =
      sanitizeCityName(context.to) ||
      sanitizeCityName(parseDestinationFromQuery(context.currentQuery)) ||
      "Destination";
    const from = sanitizeCityName(context.from) || "Source";
    const checkInDate = parseStartDate(context.checkIn);
    const summary = context.resultsSummary || null;

    const weatherTrend = await resolveWeather(destination);
    const baseFlight = getFlightBasePrice(summary);
    const flightDaily = forecastSeries(baseFlight, checkInDate, 0.045, 0.007);
    const trainBase = Math.max(550, Math.round(baseFlight * 0.34));
    const trainDaily = forecastSeries(trainBase, checkInDate, 0.02, 0.004);

    const placeCategories = buildPlaceCategories(context.activities, summary, destination);
    const foodGuide = buildFoodGuide(context.restaurants, summary, destination);
    const medicalKit = buildMedicalKit(weatherTrend.climateTag, weatherTrend);

    const payload: TripInsightsPayload = {
      generatedAt: new Date().toISOString(),
      priceForecast: {
        flight: {
          currency: "INR",
          currentBestPrice: baseFlight,
          outlook: outlookFromSeries(flightDaily),
          note: `Route considered: ${from} -> ${destination}. Forecast is trend-based and should be used as planning guidance.`,
          daily: flightDaily,
        },
        train: {
          currency: "INR",
          estimatedRange: {
            min: Math.round(trainBase * 0.78),
            max: Math.round(trainBase * 1.28),
          },
          outlook: outlookFromSeries(trainDaily),
          note: "Train forecast is estimated from route demand patterns (live train inventory not connected).",
          daily: trainDaily,
        },
      },
      weatherTrend,
      placeCategories,
      medicalKit,
      foodGuide,
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
