import { NextRequest, NextResponse } from "next/server";
import {
  searchHotels,
  searchFlights,
  getHotelInventoryDebug,
  getAirInventoryDebug,
  type HotelResult,
  type FlightResult,
} from "@/lib/tbo-api";
import { parseQueryWithGemini } from "@/lib/query-parser-ai";
import { getCurrentUser } from "@/lib/auth";
import { hasPlacesKey, searchText, photoUrl, mapsRedirectUrl, type PlaceNew } from "@/lib/google-places";
import { extractContentIntent } from "@/lib/content-extractor";
import { buildLightRecommendations } from "@/lib/light-recommender";

interface ActivityResult {
  name: string;
  category: string;
  duration: string;
  rating: number;
  reviews: number;
  price: number;
  description: string;
  tag?: string | null;
  imageUrl?: string;
  redirectUrl?: string;
}

interface RestaurantResult {
  name: string;
  cuisine: string;
  location: string;
  rating: number;
  reviews: number;
  priceRange: string;
  timing: string;
  veg: boolean;
  highlight: string;
  tag?: string | null;
  features: string[];
  imageUrl?: string;
  redirectUrl?: string;
}

interface DestinationDiningProfile {
  cuisines: string[];
  searchHints: string[];
}

interface SearchFilters {
  budget?: [number, number];
  people?: {
    adults?: number;
    children?: number;
  };
  flights?: {
    directOnly?: boolean;
    earlyMorning?: boolean;
    redEye?: boolean;
    flexiblePlusMinus2Days?: boolean;
  };
  stay?: {
    highlyRated?: boolean;
    refundable?: boolean;
    breakfastIncluded?: boolean;
    freeWifi?: boolean;
    poolSpa?: boolean;
    gym?: boolean;
  };
  activities?: Record<string, boolean>;
  dining?: Record<string, boolean>;
}

const MAX_HOTEL_RESULTS = 12;
const MAX_FLIGHT_RESULTS = 8;
const MAX_ACTIVITY_RESULTS = 8;
const MAX_RESTAURANT_RESULTS = 8;
const DEFAULT_SOURCE_CITY = "Delhi";

function toSearchUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function getDestinationTourismUrl(destination: string) {
  const key = destination.toLowerCase();
  if (key.includes("goa")) return "https://goa-tourism.com/";
  if (key.includes("bangalore") || key.includes("bengaluru")) return "https://www.karnatakatourism.org/";
  if (key.includes("jaipur") || key.includes("udaipur")) return "https://www.tourism.rajasthan.gov.in/";
  if (key.includes("kerala") || key.includes("kochi")) return "https://www.keralatourism.org/";
  if (key.includes("delhi")) return "https://delhitourism.gov.in/";
  return "https://www.incredibleindia.gov.in/";
}

function parseFilters(raw: string | null): SearchFilters | null {
  if (!raw) return null;

  const attempts = [raw];
  try {
    attempts.push(decodeURIComponent(raw));
  } catch {
    // no-op
  }

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate) as SearchFilters;
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // try next
    }
  }

  return null;
}

function parseHour(time: string | undefined): number | null {
  if (!time) return null;
  const [h] = time.split(":");
  const hour = Number(h);
  return Number.isFinite(hour) ? hour : null;
}

function parseIntParam(raw: string | null, min: number, max: number): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dt = new Date(year, (month || 1) - 1, day || 1);
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayDiff(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00`);
  const b = new Date(`${checkOut}T00:00:00`);
  const diff = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

function travellersLabel(adults: number, children: number): string {
  if (children > 0) return `${adults} Adults · ${children} ${children === 1 ? "Child" : "Children"}`;
  if (adults === 1) return "Solo";
  return `${adults} Adults`;
}

function getDestinationDiningProfile(destination: string): DestinationDiningProfile {
  const key = destination.toLowerCase();

  if (key.includes("goa")) {
    return {
      cuisines: ["Goan Seafood", "Konkani", "Beach Cafe"],
      searchHints: ["goan seafood restaurants", "beach shacks"],
    };
  }
  if (key.includes("mumbai")) {
    return {
      cuisines: ["Mumbai Street Food", "Coastal", "Modern Indian"],
      searchHints: ["street food spots", "sea view restaurants"],
    };
  }
  if (key.includes("delhi")) {
    return {
      cuisines: ["North Indian", "Mughlai", "Cafe"],
      searchHints: ["mughlai restaurants", "old delhi food spots"],
    };
  }
  if (key.includes("bangalore") || key.includes("bengaluru")) {
    return {
      cuisines: ["South Indian", "Microbrewery", "Cafe"],
      searchHints: ["south indian restaurants", "brewery restaurants"],
    };
  }
  if (key.includes("hyderabad")) {
    return {
      cuisines: ["Hyderabadi", "Biryani", "Kebabs"],
      searchHints: ["hyderabadi biryani places", "kebab restaurants"],
    };
  }
  if (key.includes("kolkata")) {
    return {
      cuisines: ["Bengali", "Kathi Rolls", "Chinese"],
      searchHints: ["bengali restaurants", "kathi roll spots"],
    };
  }
  if (key.includes("chennai")) {
    return {
      cuisines: ["Tamil", "Chettinad", "Seafood"],
      searchHints: ["chettinad restaurants", "south indian meals"],
    };
  }
  if (key.includes("jaipur") || key.includes("udaipur") || key.includes("rajasthan")) {
    return {
      cuisines: ["Rajasthani", "North Indian", "Rooftop Dining"],
      searchHints: ["rajasthani thali restaurants", "rooftop dining"],
    };
  }
  if (key.includes("kerala") || key.includes("kochi")) {
    return {
      cuisines: ["Kerala", "Malabar", "Seafood"],
      searchHints: ["kerala meals restaurants", "malabar seafood"],
    };
  }

  return {
    cuisines: ["Local Specialties", "Indian", "Cafe"],
    searchHints: ["local food restaurants", "popular restaurants"],
  };
}

function inferCuisineFromPlace(name: string, types: string[] | undefined, destination: string): string {
  const haystack = `${name} ${(types || []).join(" ")}`.toLowerCase();
  const keywordMap: Array<{ pattern: RegExp; cuisine: string }> = [
    { pattern: /(seafood|fish|crab|prawn)/, cuisine: "Seafood" },
    { pattern: /(biryani|kebab|mughlai)/, cuisine: "Mughlai / Biryani" },
    { pattern: /(south indian|dosa|idli|udupi|chettinad)/, cuisine: "South Indian" },
    { pattern: /(north indian|punjabi|thali)/, cuisine: "North Indian" },
    { pattern: /(chinese|asian|sushi|ramen|thai)/, cuisine: "Asian" },
    { pattern: /(italian|pizza|pasta)/, cuisine: "Italian" },
    { pattern: /(cafe|coffee|bakery|brunch)/, cuisine: "Cafe" },
    { pattern: /(street|chaat|dhaba|roll)/, cuisine: "Street Food" },
    { pattern: /(barbecue|bbq|grill|steak)/, cuisine: "BBQ / Grill" },
    { pattern: /(vegetarian|veg|jain)/, cuisine: "Vegetarian" },
  ];

  for (const row of keywordMap) {
    if (row.pattern.test(haystack)) return row.cuisine;
  }

  return getDestinationDiningProfile(destination).cuisines[0] || "Local Specialties";
}

/** ---------- Mock fallback (safe) ---------- */
function getMockActivities(destination: string): ActivityResult[] {
  const dest = destination.split(",")[0];
  const tourismUrl = getDestinationTourismUrl(dest);
  return [
    {
      name: `${dest} Heritage Walk`,
      category: "Culture",
      duration: "3 hours",
      rating: 4.7,
      reviews: 892,
      price: 1200,
      description: `Explore the history and culture of ${dest} with expert local guides`,
      tag: "Popular",
      imageUrl: "https://images.unsplash.com/photo-1524492514790-831f5b607f5d?auto=format&fit=crop&w=1200&q=80",
      redirectUrl: tourismUrl,
    },
    {
      name: "Sunset Kayaking",
      category: "Adventure",
      duration: "2.5 hours",
      rating: 4.9,
      reviews: 456,
      price: 1800,
      description: "Paddle through scenic waterways as the sun sets",
      tag: "Top rated",
      imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
      redirectUrl: toSearchUrl(`${dest} sunset kayaking official`),
    },
    {
      name: `${dest} Nature Trail`,
      category: "Nature",
      duration: "4 hours",
      rating: 4.6,
      reviews: 624,
      price: 950,
      description: "Easy guided trail with viewpoints and local flora",
      tag: null,
      imageUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80",
      redirectUrl: tourismUrl,
    },
  ];
}

function getMockRestaurants(destination: string): RestaurantResult[] {
  const dest = destination.split(",")[0];
  const profile = getDestinationDiningProfile(dest);
  const primaryCuisine = profile.cuisines[0] || "Local Specialties";
  const secondaryCuisine = profile.cuisines[1] || "Indian";
  return [
    {
      name: `The ${dest} Kitchen`,
      cuisine: primaryCuisine,
      location: `Central ${dest}`,
      rating: 4.7,
      reviews: 3200,
      priceRange: "$$",
      timing: "12:00 PM - 10:30 PM",
      veg: false,
      highlight: `${primaryCuisine} favorites in ${dest}`,
      tag: "Editor's pick",
      features: ["Rooftop dining", "Fine dining", primaryCuisine],
      imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
      redirectUrl: toSearchUrl(`The ${dest} Kitchen official website`),
    },
    {
      name: "Spice Garden (Pure Veg)",
      cuisine: `${secondaryCuisine} / Vegetarian`,
      location: `Old ${dest}`,
      rating: 4.5,
      reviews: 5100,
      priceRange: "$",
      timing: "11:00 AM - 11:00 PM",
      veg: true,
      highlight: `${secondaryCuisine} comfort food in ${dest}`,
      tag: "Best value",
      features: ["Veg only", "Street food", secondaryCuisine],
      imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
      redirectUrl: toSearchUrl(`Spice Garden ${dest} official website`),
    },
  ];
}

/** ---------- Helpers for dynamic results ---------- */
function priceLevelToRange(level?: string): "$" | "$$" | "$$$" {
  const v = String(level || "").toUpperCase();
  if (v.includes("VERY_EXPENSIVE")) return "$$$";
  if (v.includes("EXPENSIVE")) return "$$$";
  if (v.includes("MODERATE")) return "$$";
  if (v.includes("INEXPENSIVE")) return "$";
  if (v.includes("FREE")) return "$";
  return "$$"; // default safe
}

function estimateActivityPrice(types?: string[], budgetMax?: number): number {
  const t = (types || []).join(" ").toLowerCase();

  // INR default estimates by place type
  let base = 350;
  if (t.includes("amusement_park") || t.includes("zoo") || t.includes("aquarium")) base = 900;
  else if (t.includes("museum") || t.includes("art_gallery")) base = 400;
  else if (t.includes("park") || t.includes("natural_feature")) base = 150;
  else if (t.includes("tourist_attraction")) base = 500;

  // if user has budgetMax filter, don't exceed it (prevents filters from wiping everything)
  if (budgetMax && Number.isFinite(budgetMax)) return Math.min(base, budgetMax);
  return base;
}

function buildDiningFeatures(name: string, priceRange: string, veg: boolean, cuisine?: string): string[] {
  const features: string[] = [];
  const n = name.toLowerCase();
  const c = String(cuisine || "").toLowerCase();

  if (veg) features.push("Veg only");
  if (priceRange === "$$$") features.push("Fine dining");
  if (/\broof|\brooftop|\bterrace|\bsky\b/.test(n)) features.push("Rooftop dining");
  if (/\bstreet|\bchaat|\btandoor|\bdhaba\b/.test(n)) features.push("Street food");
  if (c.includes("seafood")) features.push("Seafood");
  if (c.includes("cafe")) features.push("Cafe");
  // keep it small & useful
  return Array.from(new Set(features));
}

/** ---------- Dynamic via Places API ---------- */
async function getDynamicActivities(destination: string, budgetMax?: number): Promise<ActivityResult[]> {
  if (!hasPlacesKey()) return getMockActivities(destination);

  const dest = destination.split(",")[0].trim();

  const places = await searchText({
    textQuery: `best things to do in ${dest}`,
    includedType: "tourist_attraction",
    maxResults: 12,
  });

  const mapped: ActivityResult[] = (places || []).slice(0, 12).map((p: PlaceNew) => {
    const name = p.displayName?.text || "Attraction";
    const photoName = p.photos?.[0]?.name;
    const placeId = p.id;

    return {
      name,
      category: (p.types?.[0] ? String(p.types[0]).replace(/_/g, " ") : "Attraction"),
      duration: "Flexible",
      rating: Number(p.rating ?? 4.3),
      reviews: Number(p.userRatingCount ?? 0),
      price: estimateActivityPrice(p.types, budgetMax),
      description: p.formattedAddress ? `Near: ${p.formattedAddress}` : `Popular activity in ${dest}`,
      tag: (Number(p.rating ?? 0) >= 4.6 ? "Top rated" : null),
      imageUrl: photoName ? photoUrl(photoName, 1200) : undefined,
      redirectUrl: placeId ? mapsRedirectUrl(placeId) : undefined,
    };
  });

  return mapped.length ? mapped : getMockActivities(destination);
}

async function getDynamicRestaurants(destination: string): Promise<RestaurantResult[]> {
  if (!hasPlacesKey()) return getMockRestaurants(destination);

  const dest = destination.split(",")[0].trim();
  const profile = getDestinationDiningProfile(dest);
  const textQueries = Array.from(
    new Set([
      `best restaurants in ${dest}`,
      ...profile.searchHints.map((hint) => `${hint} in ${dest}`),
    ])
  ).slice(0, 3);

  const searchResponses = await Promise.allSettled(
    textQueries.map((textQuery) =>
      searchText({
        textQuery,
        includedType: "restaurant",
        maxResults: 8,
      })
    )
  );
  const allPlaces = searchResponses.flatMap((res) => (res.status === "fulfilled" ? res.value : []));
  const seenKeys = new Set<string>();
  const places = allPlaces.filter((p) => {
    const key = String(p.id || p.displayName?.text || "").trim().toLowerCase();
    if (!key || seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  const mapped: RestaurantResult[] = (places || []).slice(0, 12).map((p: PlaceNew) => {
    const name = p.displayName?.text || "Restaurant";
    const photoName = p.photos?.[0]?.name;
    const placeId = p.id;

    // Best-effort veg heuristic
    const veg = /(pure veg|vegetarian|jain|\bveg\b)/i.test(name);
    const cuisine = inferCuisineFromPlace(name, p.types, dest);

    const priceRange = priceLevelToRange(p.priceLevel);
    const features = buildDiningFeatures(name, priceRange, veg, cuisine);

    return {
      name,
      cuisine,
      location: p.formattedAddress || `Central ${dest}`,
      rating: Number(p.rating ?? 4.2),
      reviews: Number(p.userRatingCount ?? 0),
      priceRange,
      timing: "Hours vary",
      veg,
      highlight: `${cuisine} dining in ${dest}`,
      tag: (Number(p.rating ?? 0) >= 4.6 ? "Top rated" : null),
      features,
      imageUrl: photoName ? photoUrl(photoName, 1200) : undefined,
      redirectUrl: placeId ? mapsRedirectUrl(placeId) : undefined,
    };
  });

  // Keep a fallback so the UI does not collapse into an empty state.
  return mapped.length ? mapped : getMockRestaurants(destination);
}

/**
 * Hotel image fallback using Places:
 * - If TBO already provides hotelImage => keep it
 * - Else search lodging photo using hotelName + destination
 */
async function enrichHotelImagesWithPlaces(destination: string, hotels: HotelResult[]) {
  if (!hasPlacesKey()) return hotels;

  const dest = destination.split(",")[0].trim();
  const MAX_LOOKUPS = 6;

  const out = [...hotels];
  const targets = out
    .map((h, idx) => ({ h, idx }))
    .filter(({ h }) => !h.hotelImage)
    .slice(0, MAX_LOOKUPS);

  await Promise.all(
    targets.map(async ({ h, idx }) => {
      const places = await searchText({
        textQuery: `${h.hotelName} ${dest}`,
        includedType: "lodging",
        maxResults: 1,
      });

      const top = places?.[0];
      const photoName = top?.photos?.[0]?.name;
      const placeId = top?.id;

      if (photoName) {
        out[idx] = {
          ...h,
          hotelImage: photoUrl(photoName, 1200),
          redirectUrl: placeId ? mapsRedirectUrl(placeId) : h.redirectUrl,
        };
      }
    })
  );

  return out;
}

/** ---------- Filters ---------- */
function applyHotelFilters(hotels: HotelResult[], filters: SearchFilters | null) {
  if (!filters) return hotels;

  let next = hotels;
  const hasAmenity = (hotel: HotelResult, token: string) =>
    Array.isArray(hotel.amenities) &&
    hotel.amenities.some((x) => x.toLowerCase() === token || x.toLowerCase().includes(token));

  const starToNumber = (rating: string | undefined) => {
    const v = String(rating || "").toLowerCase();
    if (v.includes("five") || v === "5") return 5;
    if (v.includes("four") || v === "4") return 4;
    if (v.includes("three") || v === "3") return 3;
    if (v.includes("two") || v === "2") return 2;
    if (v.includes("one") || v === "1") return 1;
    return 0;
  };

  const budgetMax = filters.budget?.[1];
  if (budgetMax && Number.isFinite(budgetMax)) {
    next = next.filter((h) => h.price <= budgetMax);
  }

  if (filters.stay?.refundable) {
    next = next.filter((h) => h.isRefundable !== false);
  }

  if (filters.stay?.highlyRated) {
    next = next.filter((h) => {
      const ta = Number(h.tripAdvisorRating ?? 0);
      const starValue = starToNumber(h.rating);
      return ta >= 4.5 || starValue >= 4;
    });
  }

  if (filters.stay?.breakfastIncluded) {
    next = next.filter((h) => {
      const meal = String(h.mealType || "").toLowerCase();
      return meal.includes("withmeal") || meal === "all" || hasAmenity(h, "breakfast");
    });
  }

  if (filters.stay?.freeWifi) {
    next = next.filter((h) => hasAmenity(h, "free_wifi") || hasAmenity(h, "wifi"));
  }

  if (filters.stay?.poolSpa) {
    next = next.filter((h) => hasAmenity(h, "pool_spa") || hasAmenity(h, "pool") || hasAmenity(h, "spa"));
  }

  if (filters.stay?.gym) {
    next = next.filter((h) => hasAmenity(h, "gym") || hasAmenity(h, "fitness"));
  }

  return next;
}

function applyFlightFilters(flights: FlightResult[], filters: SearchFilters | null) {
  if (!filters) return flights;

  let next = flights;
  const budgetMax = filters.budget?.[1];
  if (budgetMax && Number.isFinite(budgetMax)) {
    next = next.filter((f) => f.price <= budgetMax);
  }

  if (filters.flights?.directOnly) {
    next = next.filter((f) => /non-?stop/i.test(f.stops));
  }

  if (filters.flights?.earlyMorning) {
    next = next.filter((f) => {
      const h = parseHour(f.departure);
      return h !== null && h < 10;
    });
  }

  if (filters.flights?.redEye) {
    next = next.filter((f) => {
      const h = parseHour(f.departure);
      return h !== null && (h >= 22 || h < 6);
    });
  }

  return next;
}

function applyActivityFilters(activities: ActivityResult[], filters: SearchFilters | null) {
  if (!filters) return activities;

  let next = activities;
  const budgetMax = filters.budget?.[1];
  if (budgetMax && Number.isFinite(budgetMax)) {
    next = next.filter((a) => a.price <= budgetMax);
  }

  const selected = Object.entries(filters.activities ?? {})
    .filter(([, active]) => Boolean(active))
    .map(([k]) => k.toLowerCase());

  if (selected.length > 0) {
    next = next.filter((a) => {
      const category = a.category.toLowerCase();
      const name = a.name.toLowerCase();
      return selected.some((s) => category.includes(s) || name.includes(s));
    });
  }

  return next;
}

function priceRangeToEstimate(range: string) {
  if (range === "$") return 500;
  if (range === "$$") return 1200;
  return 2500;
}

function applyRestaurantFilters(restaurants: RestaurantResult[], filters: SearchFilters | null) {
  if (!filters) return restaurants;

  let next = restaurants;
  const budgetMax = filters.budget?.[1];
  if (budgetMax && Number.isFinite(budgetMax)) {
    next = next.filter((r) => priceRangeToEstimate(r.priceRange) <= budgetMax);
  }
  const baselineAfterBudget = next;

  const dining = filters.dining ?? {};
  const hasDiningSelection = Object.values(dining).some(Boolean);

  if (dining["Veg only"]) {
    next = next.filter((r) => r.veg || r.features.some((f) => /veg/i.test(f)));
  }
  if (dining["Street food"]) {
    next = next.filter((r) => r.features.some((f) => /street/i.test(f)) || r.cuisine.toLowerCase().includes("street"));
  }
  if (dining["Fine dining"]) {
    next = next.filter((r) => r.features.some((f) => /fine/i.test(f)) || r.priceRange === "$$$");
  }
  if (dining["Rooftop dining"]) {
    next = next.filter((r) => r.features.some((f) => /roof/i.test(f)));
  }
  if (dining["All-inclusive meals"]) {
    next = next.filter((r) => r.features.some((f) => /meal plan/i.test(f)));
  }

  // Graceful fallback: if selected dining tags over-filter to zero, keep budget-filtered list.
  if (hasDiningSelection && next.length === 0) {
    return baselineAfterBudget;
  }

  return next;
}

function limitResults<T>(rows: T[], max: number): T[] {
  return rows.slice(0, Math.max(1, max));
}

export async function GET(request: NextRequest) {
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") || "";
  const query = rawQuery.trim();
  const fromOverride = (searchParams.get("from") || "").trim();
  const toOverride = (searchParams.get("to") || "").trim();
  const checkInOverride = (searchParams.get("checkIn") || "").trim();
  const checkOutOverride = (searchParams.get("checkOut") || "").trim();
  const daysOverride = parseIntParam(searchParams.get("days"), 1, 30);
  const adultsOverride = parseIntParam(searchParams.get("adults"), 1, 9);
  const childrenOverride = parseIntParam(searchParams.get("children"), 0, 6);

  if (!query) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  const filters = parseFilters(searchParams.get("f"));
  const parsed = await parseQueryWithGemini(rawQuery);
  const extracted = extractContentIntent(query, parsed);

  const from = (fromOverride || parsed.from || "").trim() || DEFAULT_SOURCE_CITY;
  const parsedDestination = (parsed.destination || parsed.to || "").trim();
  let destination = (toOverride || parsedDestination || "").trim();

  if (
    destination &&
    destination.toLowerCase() === from.toLowerCase() &&
    parsedDestination &&
    parsedDestination.toLowerCase() !== from.toLowerCase()
  ) {
    destination = parsedDestination;
  }

  if (!destination) {
    return NextResponse.json({
      success: true,
      data: {
        hotels: [],
        flights: [],
        onwardFlights: [],
        returnFlights: [],
        activities: [],
        restaurants: [],
        recommendations: [],
      },
      meta: {
        ...parsed,
        parsed,
        contentExtraction: extracted,
        recommendationSummary: {
          totalTrips: 0,
          topScore: null,
        },
        destination: "",
        from,
        to: "",
        checkIn: parsed.checkIn,
        checkOut: parsed.checkOut,
        days: parsed.days,
        adults: parsed.adults,
        children: parsed.children,
        travellersLabel: travellersLabel(parsed.adults, parsed.children),
        needsDateInput: !parsed.hasExplicitDates,
        needsDurationInput: !parsed.hasExplicitDuration && !parsed.hasExplicitDates,
        questions: Array.from(new Set(["Which destination would you like to plan for?", ...parsed.clarifyingQuestions])),
        usingMock: process.env.USE_MOCK_DATA === "true",
        hotelInventory: null,
        airInventory: {
          onward: null,
          return: null,
        },
      },
    });
  }

  const peopleAdults = adultsOverride ?? filters?.people?.adults ?? parsed.adults;
  const peopleChildren = childrenOverride ?? filters?.people?.children ?? parsed.children;
  const adults = Math.max(1, Number(peopleAdults) || 1);
  const children = Math.max(0, Number(peopleChildren) || 0);

  const hasCheckInOverride = isIsoDate(checkInOverride);
  const hasCheckOutOverride = isIsoDate(checkOutOverride);
  let checkIn = hasCheckInOverride ? checkInOverride : parsed.checkIn;
  let checkOut = hasCheckOutOverride ? checkOutOverride : parsed.checkOut;
  let days = daysOverride ?? parsed.days ?? dayDiff(checkIn, checkOut);

  if (hasCheckInOverride && !hasCheckOutOverride) {
    checkOut = addDaysIso(checkIn, days);
  } else if (!hasCheckInOverride && hasCheckOutOverride) {
    checkIn = addDaysIso(checkOut, -days);
  } else if (hasCheckInOverride && hasCheckOutOverride) {
    const derived = dayDiff(checkIn, checkOut);
    if (derived > 0) {
      days = derived;
    } else {
      checkOut = addDaysIso(checkIn, Math.max(1, days));
      days = dayDiff(checkIn, checkOut);
    }
  } else if (daysOverride !== undefined) {
    checkOut = addDaysIso(checkIn, daysOverride);
    days = daysOverride;
  }

  const needsDateInput = !parsed.hasExplicitDates && !hasCheckInOverride && !hasCheckOutOverride;
  const needsDurationInput =
    !parsed.hasExplicitDuration &&
    !parsed.hasExplicitDates &&
    daysOverride === undefined &&
    !(hasCheckInOverride && hasCheckOutOverride);

  const questions = parsed.clarifyingQuestions.filter((q) => {
    if (/start date/i.test(q)) return needsDateInput;
    if (/how many days/i.test(q)) return needsDurationInput;
    return true;
  });

  const budgetMax = filters?.budget?.[1];
  const wantsBreakfast = Boolean(filters?.stay?.breakfastIncluded);

  try {
    const shouldFetchOnward = Boolean(from && destination && from !== destination);
    const shouldFetchReturn = shouldFetchOnward && Boolean(checkOut);

    const [hotelsRes, onwardFlightsRes, returnFlightsRes] = await Promise.allSettled([
      searchHotels({
        cityName: destination,
        checkIn,
        checkOut,
        adults,
        children,
        rooms: 1,
        refundable: Boolean(filters?.stay?.refundable),
        mealType: wantsBreakfast ? "WithMeal" : "All",
        budgetMax: Number.isFinite(budgetMax) ? budgetMax : undefined,
      }),
      shouldFetchOnward ? searchFlights(from, destination, checkIn, adults, children) : Promise.resolve([]),
      shouldFetchReturn ? searchFlights(destination, from, checkOut, adults, children) : Promise.resolve([]),
    ]);

    const hotels = hotelsRes.status === "fulfilled" ? hotelsRes.value : [];
    const hotelsWithImages = await enrichHotelImagesWithPlaces(destination, hotels);

    const onwardFlightsRaw = onwardFlightsRes.status === "fulfilled" ? onwardFlightsRes.value : [];
    const returnFlightsRaw = returnFlightsRes.status === "fulfilled" ? returnFlightsRes.value : [];
    const onwardFlights = limitResults(applyFlightFilters(onwardFlightsRaw, filters), MAX_FLIGHT_RESULTS);
    const returnFlights = limitResults(applyFlightFilters(returnFlightsRaw, filters), MAX_FLIGHT_RESULTS);

    const hotelInventory = getHotelInventoryDebug(destination);
    const onwardAirInventory = shouldFetchOnward ? getAirInventoryDebug(from, destination, checkIn) : null;
    const returnAirInventory = shouldFetchReturn ? getAirInventoryDebug(destination, from, checkOut) : null;

    const [activities, restaurants] = await Promise.all([
      getDynamicActivities(destination, Number.isFinite(budgetMax) ? Number(budgetMax) : undefined),
      getDynamicRestaurants(destination),
    ]);

    const filteredHotels = limitResults(applyHotelFilters(hotelsWithImages, filters), MAX_HOTEL_RESULTS);
    const filteredActivities = limitResults(applyActivityFilters(activities, filters), MAX_ACTIVITY_RESULTS);
    const filteredRestaurants = limitResults(applyRestaurantFilters(restaurants, filters), MAX_RESTAURANT_RESULTS);

    const recommendationTrips = buildLightRecommendations({
      destination,
      durationDays: days,
      flights: onwardFlights,
      hotels: filteredHotels,
      activities: filteredActivities,
      restaurants: filteredRestaurants,
      extracted,
      budgetMax: Number.isFinite(budgetMax) ? Number(budgetMax) : undefined,
      topK: 4,
    });

    return NextResponse.json({
      success: true,
      data: {
        hotels: filteredHotels,
        flights: onwardFlights,
        onwardFlights,
        returnFlights,
        activities: filteredActivities,
        restaurants: filteredRestaurants,
        recommendations: recommendationTrips,
      },
      meta: {
        ...parsed,
        parsed,
        contentExtraction: extracted,
        recommendationSummary: {
          totalTrips: recommendationTrips.length,
          topScore: recommendationTrips[0]?.score ?? null,
        },
        destination,
        from,
        to: destination,
        checkIn,
        checkOut,
        days,
        adults,
        children,
        travellersLabel: travellersLabel(adults, children),
        needsDateInput,
        needsDurationInput,
        questions,
        usingMock: process.env.USE_MOCK_DATA === "true",
        hotelInventory,
        airInventory: {
          onward: onwardAirInventory,
          return: returnAirInventory,
        },
      },
    });
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json({ error: "Search failed", details: String(err) }, { status: 500 });
  }
}
