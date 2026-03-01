"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import {
  Globe,
  Sparkles,
  ArrowLeft,
  Menu,
  WandSparkles,
  Loader2,
} from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import {
  SmartFilters,
  DEFAULT_SMART_FILTERS,
  type SmartFilterValue,
} from "@/components/smart-filters";
import { Drawer } from "@/components/ui/drawer";
import { ChatPanel } from "@/components/chat/ChatPanel";
import {
  ItineraryPreferencesPanel,
  type ItineraryInputAnswers,
} from "@/components/itinerary-preferences-panel";
import { TripInsightsPanel } from "@/components/trip-insights-panel";
import { parseQuery, type ParsedQuery } from "@/lib/query-parser";
import { buildResultsSummary } from "@/lib/results-summary";
import {
  extractItineraryPreferences,
  saveItineraryToSession,
  type ItineraryPayload,
} from "@/lib/itinerary-storage";
import type { TripInsightsPayload } from "@/lib/trip-insights";

import { CommuteColumn } from "@/components/columns/commute-column";
import { StayColumn } from "@/components/columns/stay-column";
import { ActivitiesColumn } from "@/components/columns/activities-column";
import { DineColumn } from "@/components/columns/dine-column";

interface SearchData {
  hotels: HotelResult[];
  flights: FlightResult[];
  onwardFlights?: FlightResult[];
  returnFlights?: FlightResult[];
  activities: ActivityResult[];
  restaurants: RestaurantResult[];
}

interface HotelResult {
  resultIndex: number;
  hotelCode: string;
  hotelName: string;
  hotelImage?: string;
  hotelDescription?: string;
  address?: string;
  rating?: string;
  tripAdvisorRating?: string;
  price: number;
  currency: string;
  originalPrice?: number;
}

interface FlightResult {
  airline: string;
  flightCode: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: string;
  price: number;
  stops: string;
  tag?: string;
  redirectUrl?: string;
}

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

interface ParsedMeta {
  from?: string;
  to?: string;
  destination?: string;
  days?: number;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  travellersLabel?: string;
  needsDateInput?: boolean;
  needsDurationInput?: boolean;
  questions?: string[];
}

function ChatBubblesIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect x="5" y="24" width="38" height="28" rx="7" fill="#f5b942" stroke="#1f2937" strokeWidth="3" />
      <polygon points="16,52 23,52 16,58" fill="#f5b942" stroke="#1f2937" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="17" cy="38" r="2.4" fill="#1f2937" />
      <circle cx="24" cy="38" r="2.4" fill="#1f2937" />
      <circle cx="31" cy="38" r="2.4" fill="#1f2937" />

      <rect x="24" y="7" width="35" height="28" rx="7" fill="#8ea9ea" stroke="#1f2937" strokeWidth="3" />
      <polygon points="46,35 53,35 53,42" fill="#8ea9ea" stroke="#1f2937" strokeWidth="3" strokeLinejoin="round" />
      <rect x="31" y="16" width="21" height="4" rx="2" fill="#1f2937" />
      <rect x="31" y="24" width="21" height="4" rx="2" fill="#1f2937" />
    </svg>
  );
}

function parseIntQueryParam(raw: string | null): string {
  if (!raw) return "";
  const value = raw.trim();
  if (!/^\d+$/.test(value)) return "";
  return value;
}

const DEFAULT_SOURCE_CITY = "Delhi";

function normalizeFromParam(raw: string | null): string {
  const value = (raw || "").trim();
  return value || DEFAULT_SOURCE_CITY;
}

function normalizeToParam(raw: string | null): string {
  return (raw || "").trim();
}

/** f=... helpers (URL-safe) */
function encodeFilters(filters: SmartFilterValue) {
  return JSON.stringify(filters);
}

function normalizeSmartFilters(raw: Partial<SmartFilterValue>): SmartFilterValue {
  return {
    ...DEFAULT_SMART_FILTERS,
    ...raw,
    people: { ...DEFAULT_SMART_FILTERS.people, ...(raw.people || {}) },
    flights: { ...DEFAULT_SMART_FILTERS.flights, ...(raw.flights || {}) },
    stay: { ...DEFAULT_SMART_FILTERS.stay, ...(raw.stay || {}) },
    dining: { ...DEFAULT_SMART_FILTERS.dining, ...(raw.dining || {}) },
    activities: { ...DEFAULT_SMART_FILTERS.activities, ...(raw.activities || {}) },
    localTransport: { ...DEFAULT_SMART_FILTERS.localTransport, ...(raw.localTransport || {}) },
    special: { ...DEFAULT_SMART_FILTERS.special, ...(raw.special || {}) },
    offers: { ...DEFAULT_SMART_FILTERS.offers, ...(raw.offers || {}) },
  };
}

function decodeFilters(raw: string | null): SmartFilterValue | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<SmartFilterValue>;
    return normalizeSmartFilters(parsed);
  } catch {
    return null;
  }
}

function createPromptBaseFilters(): SmartFilterValue {
  return {
    ...DEFAULT_SMART_FILTERS,
    travellerTypes: [],
    tripPace: undefined,
    travelMonths: [],
    destinationVibes: [],
    flights: {
      directOnly: false,
      earlyMorning: false,
      redEye: false,
      flexiblePlusMinus2Days: false,
    },
    stay: {
      highlyRated: false,
      refundable: false,
      breakfastIncluded: false,
      freeWifi: false,
      poolSpa: false,
      gym: false,
    },
    accommodationTypes: [],
    dining: {
      "Veg only": false,
      "Street food": false,
      "Fine dining": false,
      "Rooftop dining": false,
      "All-inclusive meals": false,
    },
    activities: {
      Adventure: false,
      Culture: false,
      Nightlife: false,
      Shopping: false,
      Nature: false,
      Wellness: false,
      "Water Sports": false,
      Photography: false,
      Pilgrimage: false,
      Wildlife: false,
    },
    localTransport: {
      "Airport transfer": false,
      "Car/bike rental": false,
      "Metro access": false,
    },
    special: {
      wheelchairAccessible: false,
      petFriendly: false,
      childFriendly: false,
      lgbtqWelcoming: false,
      honeymoonSpecial: false,
      seniorFriendly: false,
    },
    offers: {
      EMI: false,
      "UPI cashback": false,
      "Last-minute deals": false,
      "Group discounts": false,
    },
  };
}

function buildPromptAwareFilters(parsed: ParsedQuery): SmartFilterValue {
  const base = createPromptBaseFilters();
  const inferred = parsed.inferredFilters || {};

  const next: SmartFilterValue = {
    ...base,
    budget: inferred.budget ?? base.budget,
    people: {
      adults: Math.min(9, Math.max(1, Number(parsed.adults) || base.people.adults)),
      children: Math.min(6, Math.max(0, Number(parsed.children) || base.people.children)),
    },
    travellerTypes: inferred.travellerTypes ? [...inferred.travellerTypes] : [],
    tripPace: inferred.tripPace,
    travelMonths: inferred.travelMonths ? [...inferred.travelMonths] : [],
    destinationVibes: inferred.destinationVibes ? [...inferred.destinationVibes] : [],
    flights: {
      ...base.flights,
      ...(inferred.flights || {}),
    },
    stay: {
      ...base.stay,
      ...(inferred.stay || {}),
    },
    special: {
      ...base.special,
      ...(inferred.special || {}),
    },
  };

  return normalizeSmartFilters(next);
}

function defaultItineraryInputs(): ItineraryInputAnswers {
  return {
    pacePreference: "Auto",
    tripFocus: "Mixed",
    foodPreference: "Mixed",
    mobilityPreference: "Balanced",
    withKids: false,
    withSeniors: false,
    specialRequest: "",
    healthNotes: "",
  };
}

const SEARCH_SHOWCASE_SPOTS = [
  {
    title: "Goa Coastline",
    subtitle: "Beach cafes, sunset shacks and sea vibes",
    image:
      "https://images.unsplash.com/photo-1663848018507-accf7c6a2ebb?auto=format&fit=crop&w=1200&q=80",
    emoji: "IN",
  },
  {
    title: "Ladakh Trails",
    subtitle: "High passes, monasteries and mountain roads",
    image:
      "https://images.unsplash.com/photo-1684587247197-eba8068bc66f?auto=format&fit=crop&w=1200&q=80",
    emoji: "IN",
  },
  {
    title: "Jaipur Heritage",
    subtitle: "Royal palaces, bazaars and pink city charm",
    image:
      "https://images.unsplash.com/photo-1641633593415-378819228d97?auto=format&fit=crop&w=1200&q=80",
    emoji: "IN",
  },
  {
    title: "Kerala Backwaters",
    subtitle: "Houseboats, coconut shores and calm escapes",
    image:
      "https://images.unsplash.com/photo-1694783079572-eaeff4bee78b?auto=format&fit=crop&w=1200&q=80",
    emoji: "IN",
  },
];

const SEARCH_LOADING_MESSAGES = [
  "Matching your vibe with the best stays, food spots and experiences.",
  "Checking smart filters and refreshing live options for this route.",
  "Curating a smoother plan with balanced commute, stay, explore and dine picks.",
];
function SearchResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const query = searchParams.get("q") || "";
  const fParam = searchParams.get("f");
  const fromParam = normalizeFromParam(searchParams.get("from"));
  const toParam = normalizeToParam(searchParams.get("to"));
  const checkInParam = (searchParams.get("checkIn") || "").trim();
  const checkOutParam = (searchParams.get("checkOut") || "").trim();
  const daysParam = parseIntQueryParam(searchParams.get("days"));
  const adultsParam = parseIntQueryParam(searchParams.get("adults"));
  const childrenParam = parseIntQueryParam(searchParams.get("children"));

  const parsedFromPrompt = useMemo(() => {
    if (!query.trim()) return null;
    return parseQuery(query);
  }, [query]);

  const promptDerivedFilters = useMemo(() => {
    if (!parsedFromPrompt) return createPromptBaseFilters();
    return buildPromptAwareFilters(parsedFromPrompt);
  }, [parsedFromPrompt]);

  // Initialize filters from URL if present (shareable state).
  const initialFilters = useMemo(() => {
    return decodeFilters(fParam) ?? promptDerivedFilters;
  }, [fParam, promptDerivedFilters]);

  const [filters, setFilters] = useState<SmartFilterValue>(initialFilters);

  const [data, setData] = useState<SearchData | null>(null);
  const [meta, setMeta] = useState<ParsedMeta | null>(null);
  const [routeOverride, setRouteOverride] = useState<{ from: string; to: string }>({
    from: fromParam,
    to: toParam,
  });
  const [tripOverride, setTripOverride] = useState<{
    checkIn: string;
    checkOut: string;
    days: string;
    adults: string;
    children: string;
  }>({
    checkIn: checkInParam,
    checkOut: checkOutParam,
    days: daysParam,
    adults: adultsParam,
    children: childrenParam,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [itineraryGenerating, setItineraryGenerating] = useState(false);
  const [itineraryError, setItineraryError] = useState<string | null>(null);
  const [insights, setInsights] = useState<TripInsightsPayload | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [itineraryInputs, setItineraryInputs] = useState<ItineraryInputAnswers>(defaultItineraryInputs);
  const [showcaseIndex, setShowcaseIndex] = useState(0);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const filtersTriggerRef = useRef<HTMLButtonElement>(null);
  const chatTriggerRef = useRef<HTMLButtonElement>(null);
  const requestTokenRef = useRef(0);
  const activeRequestRef = useRef(0);

  const buildSearchUrl = (
    nextFilters: SmartFilterValue,
    route: { from: string; to: string },
    trip: { checkIn: string; checkOut: string; days: string; adults: string; children: string }
  ) => {
    const from = route.from.trim() || DEFAULT_SOURCE_CITY;
    const to = route.to.trim();
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("f", encodeFilters(nextFilters));
    params.set("from", from);
    if (to) params.set("to", to);
    if (trip.checkIn.trim()) params.set("checkIn", trip.checkIn.trim());
    if (trip.checkOut.trim()) params.set("checkOut", trip.checkOut.trim());
    if (trip.days.trim()) params.set("days", trip.days.trim());
    if (trip.adults.trim()) params.set("adults", trip.adults.trim());
    if (trip.children.trim()) params.set("children", trip.children.trim());
    return `/search?${params.toString()}`;
  };

  /** Single refetch function so Apply can call it */
  const refetchWith = (
    nextFilters: SmartFilterValue,
    route: { from: string; to: string },
    trip: { checkIn: string; checkOut: string; days: string; adults: string; children: string }
  ) => {
    if (!query) return;

    const from = route.from.trim() || DEFAULT_SOURCE_CITY;
    const to = route.to.trim();

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("q", query);
    params.set("f", encodeFilters(nextFilters));
    params.set("from", from);
    if (to) params.set("to", to);
    if (trip.checkIn.trim()) params.set("checkIn", trip.checkIn.trim());
    if (trip.checkOut.trim()) params.set("checkOut", trip.checkOut.trim());
    if (trip.days.trim()) params.set("days", trip.days.trim());
    if (trip.adults.trim()) params.set("adults", trip.adults.trim());
    if (trip.children.trim()) params.set("children", trip.children.trim());
    requestTokenRef.current += 1;
    const requestId = requestTokenRef.current;
    params.set("_rt", String(requestId));
    activeRequestRef.current = requestId;

    fetch(`/api/search?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => {
        if (requestId !== activeRequestRef.current) return;
        if (res.success) {
          setData(res.data);
          setMeta(res.meta || null);
        } else {
          setError(res.error || "Search failed");
        }
      })
      .catch((e) => {
        if (requestId !== activeRequestRef.current) return;
        setError(e.message);
      })
      .finally(() => {
        if (requestId !== activeRequestRef.current) return;
        setLoading(false);
      });
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      setShowcaseIndex((prev) => (prev + 1) % SEARCH_SHOWCASE_SPOTS.length);
    }, 3200);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!loading) {
      setLoadingMessageIndex(0);
      return;
    }
    const interval = window.setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % SEARCH_LOADING_MESSAGES.length);
    }, 1800);
    return () => window.clearInterval(interval);
  }, [loading]);

  // Initial load + whenever query changes: fetch with current filters
  useEffect(() => {
    if (!query) {
      router.push("/");
      return;
    }

    const nextRoute = { from: fromParam, to: toParam };
    const nextTrip = {
      checkIn: checkInParam,
      checkOut: checkOutParam,
      days: daysParam,
      adults: adultsParam,
      children: childrenParam,
    };
    setRouteOverride(nextRoute);
    setTripOverride(nextTrip);

    const nextFilters = decodeFilters(fParam) ?? promptDerivedFilters;
    setFilters(nextFilters);

    if (!fParam) {
      const nextUrl = buildSearchUrl(nextFilters, nextRoute, nextTrip);
      router.replace(nextUrl);
    }

    // When query changes, use prompt-aware filters (or URL filters) and refetch
    refetchWith(nextFilters, nextRoute, nextTrip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, promptDerivedFilters, fromParam, toParam, checkInParam, checkOutParam, daysParam, adultsParam, childrenParam]);

  // If URL f= changes externally (refresh/back), sync into state
  useEffect(() => {
    const fromUrl = decodeFilters(fParam);
    if (fromUrl) {
      setFilters(fromUrl);
      return;
    }
    setFilters(promptDerivedFilters);
  }, [fParam, promptDerivedFilters]);

  const applyFilters = (
    nextFilters: SmartFilterValue,
    tripDates: {
      checkIn: string;
      checkOut: string;
    }
  ) => {
    const nextTrip = {
      ...tripOverride,
      checkIn: tripDates.checkIn.trim(),
      checkOut: tripDates.checkOut.trim(),
      adults: String(nextFilters.people.adults),
      children: String(nextFilters.people.children),
    };

    setFilters(nextFilters);
    setTripOverride(nextTrip);

    // 1) Update URL (so shareable)
    const nextUrl = buildSearchUrl(nextFilters, routeOverride, nextTrip);
    router.replace(nextUrl);

    // 2) Refetch using filters
    refetchWith(nextFilters, routeOverride, nextTrip);

    // 3) Close drawer on mobile
    setFiltersOpen(false);
  };

  const applyCommuteRoute = (from: string, to: string) => {
    const nextRoute = {
      from: from.trim() || DEFAULT_SOURCE_CITY,
      to: to.trim(),
    };
    if (nextRoute.from === fromParam && nextRoute.to === toParam) return;
    setRouteOverride(nextRoute);
    const nextUrl = buildSearchUrl(filters, nextRoute, tripOverride);
    router.replace(nextUrl);
  };

  const effectiveTripDates = {
    checkIn: tripOverride.checkIn || meta?.checkIn || "",
    checkOut: tripOverride.checkOut || meta?.checkOut || "",
  };

  const resultsSummary = useMemo(() => buildResultsSummary(data), [data]);

  const chatContext = useMemo(
    () => ({
      currentQuery: query || null,
      currentFilters: filters || null,
      resultsSummary,
    }),
    [query, filters, resultsSummary]
  );

  useEffect(() => {
    if (!resultsSummary) {
      setInsights(null);
      setInsightsError(null);
      return;
    }

    const controller = new AbortController();
    setInsightsLoading(true);
    setInsightsError(null);

    const payload = {
      context: {
        currentQuery: query || null,
        from: routeOverride.from || meta?.from || null,
        to: meta?.to || meta?.destination || routeOverride.to || null,
        checkIn: tripOverride.checkIn || meta?.checkIn || null,
        resultsSummary,
        activities: (data?.activities || []).slice(0, 10).map((activity) => ({
          name: activity.name,
          category: activity.category,
          description: activity.description,
          rating: activity.rating,
          price: activity.price,
        })),
        restaurants: (data?.restaurants || []).slice(0, 10).map((restaurant) => ({
          name: restaurant.name,
          cuisine: restaurant.cuisine,
          location: restaurant.location,
          rating: restaurant.rating,
          priceRange: restaurant.priceRange,
          veg: restaurant.veg,
        })),
      },
    };

    fetch("/api/trip-insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as TripInsightsPayload & { error?: string };
        if (!response.ok) {
          throw new Error(result?.error || "Unable to load predictive insights.");
        }
        setInsights(result);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Unable to load predictive insights.";
        setInsightsError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setInsightsLoading(false);
      });

    return () => controller.abort();
  }, [
    data?.activities,
    data?.restaurants,
    meta?.checkIn,
    meta?.destination,
    meta?.from,
    meta?.to,
    query,
    resultsSummary,
    routeOverride.from,
    routeOverride.to,
    tripOverride.checkIn,
  ]);

  const canGenerateItinerary = useMemo(
    () => Boolean(query.trim()) && Boolean(resultsSummary) && !loading && !itineraryGenerating,
    [query, resultsSummary, loading, itineraryGenerating]
  );

  const handleGenerateItinerary = async () => {
    if (!canGenerateItinerary) return;

    setItineraryError(null);
    setItineraryGenerating(true);

    try {
      const derivedPreferences = extractItineraryPreferences(filters);
      const mergedPreferences = {
        ...derivedPreferences,
        pace:
          itineraryInputs.pacePreference === "Auto"
            ? derivedPreferences.pace
            : itineraryInputs.pacePreference,
      };

      const response = await fetch("/api/llm/itinerary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context: {
            ...chatContext,
            itineraryInputs,
            predictiveInsights: insights
              ? {
                  climateTag: insights.weatherTrend.climateTag,
                  flightOutlook: insights.priceForecast.flight.outlook,
                  trainOutlook: insights.priceForecast.train.outlook,
                }
              : null,
          },
          preferences: mergedPreferences,
        }),
      });

      const payload = (await response.json()) as ItineraryPayload & {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || "Unable to generate itinerary right now.");
      }

      const returnUrl =
        typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/search";

      saveItineraryToSession({
        itinerary: payload,
        query: query || null,
        generatedAt: new Date().toISOString(),
        returnUrl,
      });

      router.push("/itinerary");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to generate itinerary right now.";
      setItineraryError(message);
    } finally {
      setItineraryGenerating(false);
    }
  };

  return (
    <div className="voyager-page-shell relative min-h-screen bg-[var(--background)]">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, oklch(0.7 0.15 200 / 0.05) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute right-80 top-1/3 h-[400px] w-[400px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, oklch(0.75 0.12 160 / 0.04) 0%, transparent 70%)",
          }}
        />
      </div>

      <div
        className={`fixed inset-0 z-[60] flex items-center justify-center px-4 transition-opacity duration-300 ${loading ? "opacity-100" : "pointer-events-none opacity-0"}`}
        style={{
          background: "var(--scrim)",
          backdropFilter: loading ? "blur(12px)" : "blur(0px)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 18% 20%, oklch(0.74 0.16 190 / 0.22) 0%, transparent 36%), radial-gradient(circle at 82% 18%, oklch(0.74 0.15 45 / 0.2) 0%, transparent 34%), linear-gradient(135deg, oklch(0.18 0.03 232 / 0.72), oklch(0.18 0.03 205 / 0.72))",
          }}
        />
        <div
          className="pointer-events-none absolute -left-16 top-1/4 h-56 w-56 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "3.6s", background: "oklch(0.72 0.15 200 / 0.26)" }}
        />
        <div
          className="pointer-events-none absolute -right-14 bottom-1/4 h-64 w-64 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "4.2s", background: "oklch(0.72 0.15 45 / 0.24)" }}
        />
        <div
          className="relative w-full max-w-xl overflow-hidden rounded-3xl border px-6 py-7 text-center"
          style={{
            borderColor: "var(--glass-border)",
            background: "var(--surface-strong)",
            backdropFilter: "blur(22px)",
          }}
        >
          <div
            className="mx-auto mb-6 flex h-56 w-full max-w-md items-center justify-center overflow-hidden rounded-2xl border"
            style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}
          >
            <video
              className="h-full w-full object-contain"
              src="/loading-center.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              aria-label="Loading animation video"
            />
          </div>
          <div className="space-y-3 text-center">
            <p className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Sit back and relax while we plan your itinerary...
            </p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {SEARCH_LOADING_MESSAGES[loadingMessageIndex]}
            </p>
            <div className="mx-auto mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full" style={{ background: "var(--glass)" }}>
              <span
                className="block h-full w-2/5 rounded-full"
                style={{
                  background: "linear-gradient(90deg, var(--primary), var(--accent))",
                  animation: "pulse 1.2s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[75] flex items-center justify-center px-4 transition-opacity duration-300 ${itineraryGenerating ? "opacity-100" : "pointer-events-none opacity-0"}`}
        style={{ background: "var(--scrim)", backdropFilter: itineraryGenerating ? "blur(12px)" : "blur(0px)" }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 18% 20%, oklch(0.74 0.16 190 / 0.22) 0%, transparent 36%), radial-gradient(circle at 82% 18%, oklch(0.74 0.15 45 / 0.2) 0%, transparent 34%), linear-gradient(135deg, oklch(0.18 0.03 232 / 0.72), oklch(0.18 0.03 205 / 0.72))",
          }}
        />
        <div
          className="pointer-events-none absolute -left-16 top-1/4 h-56 w-56 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "3.6s", background: "oklch(0.72 0.15 200 / 0.26)" }}
        />
        <div
          className="pointer-events-none absolute -right-14 bottom-1/4 h-64 w-64 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "4.2s", background: "oklch(0.72 0.15 45 / 0.24)" }}
        />
        <div
          className="relative w-full max-w-xl overflow-hidden rounded-3xl border px-6 py-7 text-center"
          style={{
            borderColor: "var(--glass-border)",
            background: "var(--surface-strong)",
            backdropFilter: "blur(22px)",
          }}
        >
          <div
            className="mx-auto mb-6 flex h-56 w-full max-w-md items-center justify-center overflow-hidden rounded-2xl border"
            style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}
          >
            <video
              className="h-full w-full object-contain"
              src="/loading-center.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              aria-label="Loading animation video"
            />
          </div>
          <div className="space-y-3 text-center">
            <p className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Building your AI-powered itinerary...
            </p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {SEARCH_LOADING_MESSAGES[loadingMessageIndex]}
            </p>
            <div className="mx-auto mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full" style={{ background: "var(--glass)" }}>
              <span
                className="block h-full w-2/5 rounded-full"
                style={{
                  background: "linear-gradient(90deg, var(--primary), var(--accent))",
                  animation: "pulse 1.2s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        side="left"
        ariaLabel="Filters panel"
        returnFocusRef={filtersTriggerRef}
      >
        <SmartFilters
          open
          embedded
          onClose={() => setFiltersOpen(false)}
          tripDates={effectiveTripDates}
          onTripDatesChange={(next) =>
            setTripOverride((prev) => ({
              ...prev,
              checkIn: next.checkIn,
              checkOut: next.checkOut,
            }))
          }
          value={filters}
          onChange={setFilters}
          onApply={applyFilters}
          baselineValue={promptDerivedFilters}
          resetValue={promptDerivedFilters}
        />
      </Drawer>

      <Drawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        side="right"
        ariaLabel="Chat assistant panel"
        returnFocusRef={chatTriggerRef}
      >
        <ChatPanel context={chatContext} />
      </Drawer>

      {/* Main content */}
      <div className="relative z-10 mr-0 transition-all duration-300">
        {/* Header */}
        <header
          className="border-b px-6 py-4 shadow-[0_8px_28px_oklch(0.15_0.03_240_/_0.1)]"
          style={{
            borderColor: "var(--glass-border)",
            background:
              "linear-gradient(140deg, color-mix(in oklch, var(--surface-strong) 86%, white 14%), color-mix(in oklch, var(--surface-soft) 90%, white 10%))",
            backdropFilter: "blur(24px)",
            position: "sticky",
            top: 0,
            zIndex: 30,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                ref={filtersTriggerRef}
                type="button"
                onClick={() => {
                  setChatOpen(false);
                  setFiltersOpen((prev) => !prev);
                }}
                className="voyager-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors"
                style={{
                  color: "var(--muted-foreground)",
                }}
                aria-label="Open filters"
                aria-expanded={filtersOpen}
                title="Filters"
              >
                <Menu className="h-4 w-4" />
                Filters
              </button>

              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors"
                style={{ color: "var(--muted-foreground)" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color =
                    "var(--foreground)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color =
                    "var(--muted-foreground)")
                }
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: "oklch(0.7 0.15 200 / 0.15)" }}
                >
                  <Globe className="h-4 w-4" style={{ color: "var(--primary)" }} />
                </div>
                <span className="text-base font-bold" style={{ color: "var(--foreground)" }}>
                  Voyager
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                ref={chatTriggerRef}
                type="button"
                onClick={() => {
                  setFiltersOpen(false);
                  setChatOpen((prev) => !prev);
                }}
                className="voyager-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors"
                style={{
                  color: "var(--muted-foreground)",
                }}
                aria-label="Open chat assistant"
                aria-expanded={chatOpen}
                title="Chat"
              >
                <ChatBubblesIcon className="h-5 w-5" />
                Chat
              </button>

              <span
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
                style={{
                  borderColor: "var(--glass-border)",
                  background: "var(--glass)",
                  color: "var(--muted-foreground)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <Sparkles className="h-3 w-3" style={{ color: "var(--primary)" }} />
                AI-powered
              </span>
            </div>
          </div>
        </header>

        {/* Search section */}
        <section className="px-6 pt-8 pb-7">
          <div
            className="rounded-3xl border px-5 py-6 shadow-xl md:px-8 md:py-8"
            style={{
              opacity: 1,
              transform: "translateY(0)",
              transition: "all 0.4s ease",
              borderColor: "var(--glass-border)",
              background:
                "linear-gradient(140deg, color-mix(in oklch, var(--surface-strong) 84%, white 16%), color-mix(in oklch, var(--surface-soft) 82%, white 18%))",
              backdropFilter: "blur(18px)",
              boxShadow: "0 22px 42px oklch(0.14 0.03 240 / 0.1), inset 0 1px 0 oklch(1 0 0 / 0.55)",
            }}
          >
            <div className="mb-6 text-center">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "var(--foreground)" }}>
                Where to next?
              </h2>
              <p className="mt-2 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                Describe your dream trip and we&apos;ll find everything you need.
              </p>
            </div>

            {/* SearchBar already pushes /search?q=...; filters kept unless you also update SearchBar */}
            <SearchBar initialQuery={query} />

            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--foreground)" }}>
                  Trending Sites to Watch Out For
                </p>
                <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                  Top Indian escapes that suit your next trip
                </p>
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
                {SEARCH_SHOWCASE_SPOTS.map((spot, index) => {
                  const active = index === showcaseIndex;
                  return (
                    <article
                      key={spot.title}
                      className="relative h-36 overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                      style={{
                        borderColor: active ? "oklch(0.74 0.14 220 / 0.9)" : "var(--glass-border)",
                        boxShadow: active
                          ? "0 0 0 1px oklch(0.74 0.14 220 / 0.75), 0 22px 44px oklch(0.12 0.02 230 / 0.34)"
                          : "0 12px 28px oklch(0.12 0.02 230 / 0.16)",
                      }}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `linear-gradient(0deg, oklch(0.12 0.02 250 / 0.72), transparent 60%), url('${spot.image}')`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                      <div className="relative flex h-full flex-col justify-end p-3">
                        <span className="text-xl">{spot.emoji}</span>
                        <p className="text-sm font-semibold text-white">{spot.title}</p>
                        <p className="text-xs text-white/80">{spot.subtitle}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Results section */}
        <main className="px-6 pb-12">
          {/* Section header */}
          <div
            className="voyager-soft-card mb-6 flex items-center justify-between rounded-2xl px-4 py-3"
            style={{ borderColor: "var(--glass-border)", background: "var(--surface-soft)" }}
          >
            <div>
              <h3 className="text-lg font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
                Search Results
              </h3>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                {meta?.from && meta?.to ? `${meta.from} → ${meta.to}` : meta?.destination || query}{" "}
                {meta?.days ? `· ${meta.days} days` : ""}{" "}
                {meta?.travellersLabel ? `· ${meta.travellersLabel}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateItinerary}
                disabled={!canGenerateItinerary}
                className="voyager-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition duration-300 hover:-translate-y-0.5 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45"
                style={{
                  color: "var(--foreground)",
                  backdropFilter: "blur(10px)",
                  boxShadow: "0 10px 22px oklch(0.14 0.03 240 / 0.12)",
                }}
              >
                {itineraryGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                Generate Itinerary
              </button>

              <div
                className="voyager-soft-card flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--glass-border)",
                  color: "var(--muted-foreground)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
                Live prices
              </div>
            </div>
          </div>

          {/* 4-column grid */}
          <div className="flex gap-5 overflow-x-auto pb-4" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent" }}>
            {/* Commute */}
            <div className="w-[470px] min-w-[470px] shrink-0 rounded-2xl border shadow-[0_16px_34px_oklch(0.15_0.03_240_/_0.13)]" style={{ borderColor: "var(--glass-border)", background: "linear-gradient(160deg, var(--surface-soft), color-mix(in oklch, var(--surface-strong) 80%, white 20%))", backdropFilter: "blur(14px)" }}>
              <div className="sticky top-0 z-10 rounded-t-2xl border-b px-5 py-3" style={{ borderColor: "var(--glass-border)", background: "var(--surface-strong)", backdropFilter: "blur(20px)" }}>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--primary)" }}>
                  Commute
                </span>
              </div>
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto p-5">
                <CommuteColumn
                  loading={loading}
                  onwardFlights={data?.onwardFlights || data?.flights}
                  returnFlights={data?.returnFlights}
                  from={routeOverride.from || meta?.from}
                  to={meta?.to || meta?.destination || routeOverride.to}
                  onwardDate={tripOverride.checkIn || meta?.checkIn}
                  returnDate={tripOverride.checkOut || meta?.checkOut}
                  onApplyRoute={applyCommuteRoute}
                />
              </div>
            </div>

            {/* Stay */}
            <div className="w-[380px] min-w-[380px] shrink-0 rounded-2xl border shadow-[0_16px_34px_oklch(0.15_0.03_240_/_0.13)]" style={{ borderColor: "var(--glass-border)", background: "linear-gradient(160deg, var(--surface-soft), color-mix(in oklch, var(--surface-strong) 80%, white 20%))", backdropFilter: "blur(14px)" }}>
              <div className="sticky top-0 z-10 rounded-t-2xl border-b px-5 py-3" style={{ borderColor: "var(--glass-border)", background: "var(--surface-strong)", backdropFilter: "blur(20px)" }}>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--chart-5)" }}>
                  Stay
                </span>
              </div>
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto p-5">
                <StayColumn loading={loading} hotels={data?.hotels} />
              </div>
            </div>

            {/* Activities */}
            <div className="w-[380px] min-w-[380px] shrink-0 rounded-2xl border shadow-[0_16px_34px_oklch(0.15_0.03_240_/_0.13)]" style={{ borderColor: "var(--glass-border)", background: "linear-gradient(160deg, var(--surface-soft), color-mix(in oklch, var(--surface-strong) 80%, white 20%))", backdropFilter: "blur(14px)" }}>
              <div className="sticky top-0 z-10 rounded-t-2xl border-b px-5 py-3" style={{ borderColor: "var(--glass-border)", background: "var(--surface-strong)", backdropFilter: "blur(20px)" }}>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--chart-3)" }}>
                  Activities
                </span>
              </div>
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto p-5">
                <ActivitiesColumn loading={loading} activities={data?.activities} />
              </div>
            </div>

            {/* Dine */}
            <div className="w-[380px] min-w-[380px] shrink-0 rounded-2xl border shadow-[0_16px_34px_oklch(0.15_0.03_240_/_0.13)]" style={{ borderColor: "var(--glass-border)", background: "linear-gradient(160deg, var(--surface-soft), color-mix(in oklch, var(--surface-strong) 80%, white 20%))", backdropFilter: "blur(14px)" }}>
              <div className="sticky top-0 z-10 rounded-t-2xl border-b px-5 py-3" style={{ borderColor: "var(--glass-border)", background: "var(--surface-strong)", backdropFilter: "blur(20px)" }}>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
                  Dine
                </span>
              </div>
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto p-5">
                <DineColumn loading={loading} restaurants={data?.restaurants} />
              </div>
            </div>
          </div>

          <TripInsightsPanel loading={insightsLoading} error={insightsError} insights={insights} />

          <ItineraryPreferencesPanel value={itineraryInputs} onChange={setItineraryInputs} />

          <div
            className="voyager-glass-card relative mt-6 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl px-5 py-4 shadow-xl transition duration-300 md:px-6 md:py-5"
            style={{
              borderColor: "var(--glass-border)",
              background:
                "linear-gradient(145deg, color-mix(in oklch, var(--surface-strong) 88%, white 12%), color-mix(in oklch, var(--surface-soft) 82%, white 18%))",
              backdropFilter: "blur(20px)",
              boxShadow: "0 24px 44px oklch(0.2 0.03 240 / 0.16), inset 0 1px 0 oklch(1 0 0 / 0.62)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -left-20 top-1/2 h-52 w-52 -translate-y-1/2 rounded-full blur-3xl"
              style={{ background: "color-mix(in oklch, var(--chart-1) 18%, transparent)" }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 top-1/2 h-52 w-52 -translate-y-1/2 rounded-full blur-3xl"
              style={{ background: "color-mix(in oklch, var(--chart-3) 18%, transparent)" }}
            />
            <div className="relative">
              <p className="text-[1.35rem] font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
                Ready to convert these results into a full trip plan?
              </p>
              <p className="mt-1 text-[15px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                AI will recommend a complete day-wise itinerary with timings and budget.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateItinerary}
              disabled={!canGenerateItinerary}
              className="voyager-btn-primary relative inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition duration-300 hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-[0_16px_34px_oklch(0.62_0.16_45_/_0.34)] disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                color: "var(--primary-foreground)",
                boxShadow: "0 12px 24px oklch(0.6 0.16 45 / 0.28), inset 0 1px 0 oklch(1 0 0 / 0.35)",
              }}
            >
              {itineraryGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              Generate Itinerary
            </button>
          </div>

          {itineraryError && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {itineraryError}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--background)" }}>
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Loading...
            </span>
          </div>
        </div>
      }
    >
      <SearchResultsContent />
    </Suspense>
  );
}


