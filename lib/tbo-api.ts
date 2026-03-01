/**
 * TBO API Service (Updated)
 * - Hotels: TBOH Hotel API v2.1 (REST JSON) -> BaseURL/Search (POST) + Basic Auth
 * - Flights: Optional TBO Air (if configured), else mock
 *
 * Set USE_MOCK_DATA=true in .env.local when live credentials are unavailable.
 */

const USE_MOCK = process.env.USE_MOCK_DATA === "true";

/** =========================
 * ENV (Hotels)
 * ========================= */
function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

const TBO_HOTEL_BASE_URL = stripTrailingSlash(
  process.env.TBO_HOTEL_BASE_URL || "http://api.tbotechnology.in/TBOHolidays_HotelAPI"
);

const TBO_HOTEL_USERNAME = process.env.TBO_HOTEL_USERNAME || process.env.TBO_USERNAME || "";
const TBO_HOTEL_PASSWORD = process.env.TBO_HOTEL_PASSWORD || process.env.TBO_PASSWORD || "";
const TBO_HOTEL_COUNTRY_CODE = process.env.TBO_HOTEL_COUNTRY_CODE || "IN";

/** =========================
 * Types
 * ========================= */
export type TBOMealType = "All" | "WithMeal" | "RoomOnly";

export interface HotelSearchParams {
  /**
   * For demo/mock: cityName works.
   * For real TBOH Search API v2.1: HotelCodes is required (comma-separated).
   * If you don't have hotel codes yet, keep USE_MOCK_DATA=true.
   */
  cityName: string;

  /**
   * REAL API expects HotelCodes as comma-separated list.
   * You can supply hotelCodes from your own city->hotelCodes mapping.
   */
  hotelCodes?: string | string[];

  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD

  adults: number;
  children?: number;
  childrenAges?: number[];

  rooms?: number;

  guestNationality?: string; // ISO2 like "IN"
  currency?: string; // kept for route compatibility / mock
  responseTimeSeconds?: number; // recommended 5-23
  isDetailedResponse?: boolean;

  // Filters (v2.1)
  refundable?: boolean; // true => only refundable rooms
  noOfRoomsFilter?: number; // max rooms returned
  mealType?: TBOMealType;

  // Extra client-side filters (we can apply after response)
  budgetMax?: number;
}

export interface HotelResult {
  resultIndex: number;
  hotelCode: string;
  hotelName: string;
  hotelImage?: string;
  hotelDescription?: string;
  latitude?: string;
  longitude?: string;
  address?: string;
  rating?: string;
  tripAdvisorRating?: string;
  price: number;
  currency: string;
  originalPrice?: number;

  /** Optional: useful for SmartFilters */
  isRefundable?: boolean;
  mealType?: string;
  amenities?: string[];

  /** For your "redirection links must exist" requirement */
  redirectUrl?: string;
}

export interface FlightResult {
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

export type HotelInventorySource = "live" | "static-catalog" | "demo-mock";

export interface HotelInventoryDebug {
  source: HotelInventorySource;
  reason?: string;
  at: string;
}

export type AirInventorySource = "live" | "demo-mock";

export interface AirInventoryDebug {
  source: AirInventorySource;
  reason?: string;
  at: string;
  from: string;
  to: string;
  date: string;
}

/** =========================
 * Helpers
 * ========================= */
function basicAuthHeader(username: string, password: string) {
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${token}`;
}

function safeNumber(x: unknown, fallback = 0): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function getOfficialHotelWebsite(hotelName: string): string | null {
  const lower = hotelName.toLowerCase();
  if (lower.includes("taj")) return "https://www.ihcltata.com/";
  if (lower.includes("marriott")) return "https://www.marriott.com/";
  if (lower.includes("ibis")) return "https://all.accor.com/brands/ibis.en.shtml";
  if (lower.includes("lemon tree")) return "https://www.lemontreehotels.com/";
  return null;
}

function buildHotelRedirectUrl(hotelName: string, cityName: string) {
  const official = getOfficialHotelWebsite(hotelName);
  if (official) return official;

  const q = encodeURIComponent(`${hotelName} ${cityName}`);
  return `https://www.google.com/travel/hotels?q=${q}`;
}

function buildFlightRedirectUrl(from: string, to: string, dateISO?: string) {
  // Google Flights search link for quick redirection
  const d = dateISO ? dateISO : "";
  const q = encodeURIComponent(`${from} to ${to} ${d}`.trim());
  return `https://www.google.com/travel/flights?q=${q}`;
}

function normalizeLocationName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const HOTEL_CODE_CACHE = new Map<string, string[]>();
const HOTEL_STATIC_CACHE = new Map<string, HotelResult[]>();
const HOTEL_SOURCE_BY_CITY = new Map<string, HotelInventoryDebug>();
const AIR_SOURCE_BY_ROUTE = new Map<string, AirInventoryDebug>();
const MAX_HOTEL_CODES = Math.max(40, Number(process.env.TBO_HOTEL_CODE_LIMIT || 240));
const MAX_HOTEL_CATALOG_RESULTS = Math.max(40, Number(process.env.TBO_HOTEL_CATALOG_RESULT_LIMIT || 300));
const HOTEL_FALLBACK_LOGGED = new Set<string>();
const AIR_NO_RESULT_LOGGED = new Set<string>();
const TBO_HOTEL_SEARCH_TIMEOUT_MS = Math.max(5000, Number(process.env.TBO_HOTEL_SEARCH_TIMEOUT_MS || 12000));
const TBO_HOTEL_FLEX_SEARCH_ENABLED = process.env.TBO_HOTEL_FLEX_SEARCH !== "false";
const TBO_HOTEL_CATALOG_ONLY = process.env.TBO_HOTEL_CATALOG_ONLY !== "false";

function parseFlexDayOffsets(): number[] {
  const raw = process.env.TBO_HOTEL_FLEX_DAY_OFFSETS || "0,2,7";
  const offsets = raw
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 60)
    .map((n) => Math.round(n));
  const unique = Array.from(new Set(offsets));
  return unique.length > 0 ? unique : [0];
}

const TBO_HOTEL_FLEX_DAY_OFFSETS = parseFlexDayOffsets();
const REGION_ALIASES: Record<string, string[]> = {
  punjab: ["amritsar", "chandigarh", "ludhiana", "jalandhar"],
  rajasthan: ["jaipur", "udaipur", "jodhpur"],
  kerala: ["kochi", "trivandrum", "thiruvananthapuram", "munnar"],
  himachal: ["manali", "shimla", "dharamshala"],
  karnataka: ["bangalore", "bengaluru", "mysore", "mangalore"],
  gujarat: ["ahmedabad", "surat", "vadodara"],
  maharashtra: ["mumbai", "pune", "nagpur"],
  tamilnadu: ["chennai", "madurai", "coimbatore"],
  "tamil nadu": ["chennai", "madurai", "coimbatore"],
};

const DEFAULT_DEMO_HOTEL_CODES_BY_CITY: Record<string, string[]> = {
  "new delhi": ["1247101"],
  delhi: ["1247101"],
  goa: ["1247101"],
  jaipur: ["1247101"],
  amritsar: ["1247101"],
  mumbai: ["1247101"],
  bangalore: ["1247101"],
  bengaluru: ["1247101"],
  chennai: ["1247101"],
  kochi: ["1247101"],
};

function parseDemoHotelCodes(): Record<string, string[]> {
  const raw = process.env.TBO_DEMO_HOTEL_CODES || "";
  if (!raw.trim()) return DEFAULT_DEMO_HOTEL_CODES_BY_CITY;

  try {
    const parsed = JSON.parse(raw) as Record<string, string | string[]>;
    const normalized: Record<string, string[]> = { ...DEFAULT_DEMO_HOTEL_CODES_BY_CITY };
    for (const [city, codesRaw] of Object.entries(parsed || {})) {
      const key = normalizeLocationName(city);
      if (!key) continue;
      const codes = Array.isArray(codesRaw)
        ? codesRaw.map((c) => String(c).trim()).filter(Boolean)
        : String(codesRaw)
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);
      if (codes.length > 0) normalized[key] = codes;
    }
    return normalized;
  } catch {
    return DEFAULT_DEMO_HOTEL_CODES_BY_CITY;
  }
}

const DEMO_HOTEL_CODES_BY_CITY = parseDemoHotelCodes();

function setHotelInventoryDebug(cityName: string, source: HotelInventorySource, reason?: string) {
  const key = normalizeLocationName(cityName);
  if (!key) return;
  HOTEL_SOURCE_BY_CITY.set(key, {
    source,
    reason,
    at: new Date().toISOString(),
  });
}

export function getHotelInventoryDebug(cityName: string): HotelInventoryDebug | null {
  const key = normalizeLocationName(cityName);
  if (!key) return null;
  return HOTEL_SOURCE_BY_CITY.get(key) || null;
}

function makeAirRouteKey(from: string, to: string, date: string): string {
  return `${normalizeLocationName(from)}|${normalizeLocationName(to)}|${date.trim()}`;
}

function setAirInventoryDebug(from: string, to: string, date: string, source: AirInventorySource, reason?: string) {
  const key = makeAirRouteKey(from, to, date);
  if (!key) return;
  AIR_SOURCE_BY_ROUTE.set(key, {
    source,
    reason,
    from: from.trim(),
    to: to.trim(),
    date: date.trim(),
    at: new Date().toISOString(),
  });
}

export function getAirInventoryDebug(from: string, to: string, date?: string): AirInventoryDebug | null {
  const normalizedDate = (date || "").trim();
  if (!normalizedDate) return null;
  const key = makeAirRouteKey(from, to, normalizedDate);
  if (!key) return null;
  return AIR_SOURCE_BY_ROUTE.get(key) || null;
}

function getDemoHotelCodes(cityName: string): string[] {
  const normalized = normalizeLocationName(cityName);
  if (!normalized) return [];
  return DEMO_HOTEL_CODES_BY_CITY[normalized] || [];
}

type TBOCityRow = {
  Code?: string | number;
  Name?: string;
  CityCode?: string | number;
  CityName?: string;
};

type TBOHotelCodeRow = {
  HotelCode?: string | number;
  HotelName?: string;
  Latitude?: string;
  Longitude?: string;
  HotelRating?: string;
  Address?: string;
  CountryName?: string;
  CountryCode?: string;
  CityName?: string;
};

function resolveTargetCandidates(cityName: string): string[] {
  const normalizedTarget = normalizeLocationName(cityName);
  if (!normalizedTarget) return [];
  return Array.from(new Set([normalizedTarget, ...(REGION_ALIASES[normalizedTarget] || [])]));
}

function pickCandidateCities(cityList: TBOCityRow[], targetCandidates: string[]): TBOCityRow[] {
  const cityLabel = (c: TBOCityRow) => normalizeLocationName(c.Name || c.CityName || "");
  const exact = cityList.filter((c) => targetCandidates.includes(cityLabel(c)));
  const fuzzy = cityList.filter((c) => {
    const n = cityLabel(c);
    return targetCandidates.some((candidate) => n.includes(candidate) || candidate.includes(n));
  });
  return (exact.length > 0 ? exact : fuzzy).slice(0, 6);
}

function ratingToStarEnum(raw: string | undefined): string {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "ThreeStar";
  if (value.includes("five") || value === "5" || value.includes("5star")) return "FiveStar";
  if (value.includes("four") || value === "4" || value.includes("4star")) return "FourStar";
  if (value.includes("three") || value === "3" || value.includes("3star")) return "ThreeStar";
  if (value.includes("two") || value === "2" || value.includes("2star")) return "TwoStar";
  if (value.includes("one") || value === "1" || value.includes("1star")) return "OneStar";
  return "ThreeStar";
}

function codeHash(code: string): number {
  let hash = 0;
  for (let i = 0; i < code.length; i += 1) {
    hash += code.charCodeAt(i) * (i + 7);
  }
  return hash;
}

function inferAmenitiesFromCode(code: string): string[] {
  const hash = codeHash(code);
  const amenities: string[] = [];
  if (hash % 2 === 0) amenities.push("free_wifi");
  if (hash % 3 === 0) amenities.push("pool_spa");
  if (hash % 5 <= 1) amenities.push("gym");
  if (hash % 4 <= 2) amenities.push("breakfast");
  return amenities;
}

function inferMealTypeFromCode(code: string): string {
  const hash = codeHash(code) % 3;
  if (hash === 0) return "RoomOnly";
  if (hash === 1) return "WithMeal";
  return "All";
}

function pseudoPriceFromCode(code: string, budgetMax?: number): number {
  const base = 3200 + (codeHash(code) % 11000);
  if (budgetMax && budgetMax > 3000) {
    return Math.min(base, Math.max(2500, budgetMax - 500));
  }
  return base;
}

async function fetchStaticHotelCatalogForCity(cityName: string): Promise<HotelResult[]> {
  const normalizedTarget = normalizeLocationName(cityName);
  if (!normalizedTarget) return [];
  if (HOTEL_STATIC_CACHE.has(normalizedTarget)) {
    return HOTEL_STATIC_CACHE.get(normalizedTarget) || [];
  }

  const targetCandidates = resolveTargetCandidates(cityName);
  if (targetCandidates.length === 0) return [];

  const countryCandidates = Array.from(
    new Set([TBO_HOTEL_COUNTRY_CODE, "IN", "101"].map((x) => String(x).trim()).filter(Boolean))
  );

  let cityList: TBOCityRow[] = [];
  for (const countryCode of countryCandidates) {
    try {
      const data = await postTBOHotel<{ CityList?: TBOCityRow[] }>("CityList", { CountryCode: countryCode });
      const rows = Array.isArray(data?.CityList) ? data.CityList : [];
      if (rows.length > 0) {
        cityList = rows;
        break;
      }
    } catch {
      // try next candidate
    }
  }

  if (cityList.length === 0) {
    HOTEL_STATIC_CACHE.set(normalizedTarget, []);
    return [];
  }

  const cities = pickCandidateCities(cityList, targetCandidates);
  const seenCodes = new Set<string>();
  const catalog: HotelResult[] = [];

  for (const city of cities) {
    const cityCodeRaw = city.Code ?? city.CityCode ?? "";
    const cityCode = String(cityCodeRaw).trim();
    if (!cityCode) continue;

    try {
      const data = await postTBOHotel<{
        Hotels?: TBOHotelCodeRow[];
        HotelCodes?: Array<{ HotelCode?: string | number } | string | number>;
      }>("TBOHotelCodeList", {
        CityCode: Number.isFinite(Number(cityCode)) ? Number(cityCode) : cityCode,
        IsDetailedResponse: false,
      });

      const hotelsFromList: TBOHotelCodeRow[] = Array.isArray(data?.Hotels)
        ? data.Hotels
        : Array.isArray(data?.HotelCodes)
          ? data.HotelCodes.map((h) => {
              if (typeof h === "string" || typeof h === "number") {
                return { HotelCode: String(h).trim() };
              }
              return { HotelCode: String(h?.HotelCode ?? "").trim() };
            })
          : [];

      for (const h of hotelsFromList) {
        const code = String(h?.HotelCode ?? "").trim();
        if (!code || seenCodes.has(code)) continue;
        seenCodes.add(code);

        const hotelName = String(h?.HotelName || `Hotel ${code}`).trim();
        const price = pseudoPriceFromCode(code);
        const star = ratingToStarEnum(h?.HotelRating);
        const address = String(h?.Address || h?.CityName || city.Name || cityName || "").trim();
        const mealType = inferMealTypeFromCode(code);
        const amenities = inferAmenitiesFromCode(code);

        catalog.push({
          resultIndex: catalog.length + 1,
          hotelCode: code,
          hotelName,
          address,
          rating: star,
          tripAdvisorRating: (3.8 + ((codeHash(code) % 13) / 10)).toFixed(1),
          price,
          currency: "INR",
          originalPrice: Math.round(price * 1.22),
          isRefundable: codeHash(code) % 2 === 0,
          mealType,
          amenities,
          redirectUrl: buildHotelRedirectUrl(hotelName, cityName),
        });

        if (catalog.length >= MAX_HOTEL_CATALOG_RESULTS) break;
      }
      if (catalog.length >= MAX_HOTEL_CATALOG_RESULTS) break;
    } catch {
      // skip city and continue
    }
  }

  HOTEL_STATIC_CACHE.set(normalizedTarget, catalog);
  return catalog;
}

async function postTBOHotel<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${TBO_HOTEL_BASE_URL}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(TBO_HOTEL_USERNAME, TBO_HOTEL_PASSWORD),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`TBOH ${path} failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = text ? (JSON.parse(text) as T) : ({} as T);
  const status = (data as { Status?: { Code?: number | string; Description?: string } }).Status;
  const code = Number(status?.Code);
  if (Number.isFinite(code) && code > 0 && code !== 200) {
    const desc = status?.Description || "Unknown hotel API error";
    throw new Error(`TBOH ${path} rejected (${code}): ${desc}`);
  }

  return data as T;
}

async function fetchHotelCodesForCity(cityName: string): Promise<string[]> {
  const normalizedTarget = normalizeLocationName(cityName);
  if (!normalizedTarget) return [];

  if (HOTEL_CODE_CACHE.has(normalizedTarget)) {
    return HOTEL_CODE_CACHE.get(normalizedTarget) || [];
  }

  const targetCandidates = Array.from(new Set([normalizedTarget, ...(REGION_ALIASES[normalizedTarget] || [])]));

  const countryCandidates = Array.from(
    new Set([TBO_HOTEL_COUNTRY_CODE, "IN", "101"].map((x) => String(x).trim()).filter(Boolean))
  );

  let cityList: Array<{ Code?: string | number; Name?: string; CityCode?: string | number; CityName?: string }> = [];
  for (const countryCode of countryCandidates) {
    try {
      const data = await postTBOHotel<{
        CityList?: Array<{ Code?: string | number; Name?: string; CityCode?: string | number; CityName?: string }>;
      }>("CityList", { CountryCode: countryCode });
      const rows = Array.isArray(data?.CityList) ? data.CityList : [];
      if (rows.length > 0) {
        cityList = rows;
        break;
      }
    } catch {
      // try next country code candidate
    }
  }

  if (cityList.length === 0) {
    HOTEL_CODE_CACHE.set(normalizedTarget, []);
    return [];
  }

  const cityLabel = (c: { Name?: string; CityName?: string }) => normalizeLocationName(c.Name || c.CityName || "");

  const exact = cityList.filter((c) => targetCandidates.includes(cityLabel(c)));
  const fuzzy = cityList.filter((c) => {
    const n = cityLabel(c);
    return targetCandidates.some((candidate) => n.includes(candidate) || candidate.includes(n));
  });
  const candidates = (exact.length > 0 ? exact : fuzzy).slice(0, 4);

  const hotelCodes: string[] = [];
  for (const city of candidates) {
    const cityCodeRaw = city.Code ?? city.CityCode ?? "";
    const cityCode = String(cityCodeRaw).trim();
    if (!cityCode) continue;

    try {
      const data = await postTBOHotel<{
        Hotels?: Array<{ HotelCode?: string | number }>;
        HotelCodes?: Array<{ HotelCode?: string | number } | string | number>;
      }>("TBOHotelCodeList", {
        CityCode: Number.isFinite(Number(cityCode)) ? Number(cityCode) : cityCode,
        IsDetailedResponse: false,
      });
      const fromHotels = Array.isArray(data?.Hotels)
        ? data.Hotels.map((h) => String(h.HotelCode ?? "").trim()).filter(Boolean)
        : [];
      const fromHotelCodes = Array.isArray(data?.HotelCodes)
        ? data.HotelCodes
            .map((h) => {
              if (typeof h === "string" || typeof h === "number") return String(h).trim();
              return String((h as { HotelCode?: string | number })?.HotelCode ?? "").trim();
            })
            .filter(Boolean)
        : [];
      const codes = [...fromHotels, ...fromHotelCodes];

      for (const code of codes) {
        if (!hotelCodes.includes(code)) {
          hotelCodes.push(code);
          if (hotelCodes.length >= MAX_HOTEL_CODES) break;
        }
      }
      if (hotelCodes.length >= MAX_HOTEL_CODES) break;
    } catch {
      // skip this city and continue
    }
  }

  HOTEL_CODE_CACHE.set(normalizedTarget, hotelCodes);
  return hotelCodes;
}

function shiftIsoDate(dateIso: string, deltaDays: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(y || 1970, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

type RawHotelSearchPrice = {
  TotalPrice?: number | string;
  Price?: number | string;
  OriginalPrice?: number | string;
  OfferedPrice?: number | string;
  Currency?: string;
};

type RawHotelSearchItem = {
  ResultIndex?: number | string;
  HotelCode?: string | number;
  HotelName?: string;
  HotelDetails?: { HotelName?: string; HotelCode?: string | number };
  HotelPicture?: string;
  HotelImage?: string;
  HotelDescription?: string;
  HotelAddress?: string;
  Address?: string;
  StarRating?: string | number;
  HotelCategory?: string | number;
  TripAdvisorRating?: string | number;
  MinHotelPrice?: RawHotelSearchPrice;
  Price?: { PublishedPriceRoundedOff?: number | string } | number | string;
  OriginalPrice?: number | string;
  IsRefundable?: boolean;
  MealType?: string;
};

type RawHotelSearchPayload = {
  HotelSearchResult?: {
    HotelResults?: RawHotelSearchItem[];
    HotelResult?: RawHotelSearchItem[];
    PreferredCurrency?: string;
    Currency?: string;
  };
  HotelResults?: RawHotelSearchItem[];
};

function mapTBOHotelSearchResults(data: RawHotelSearchPayload, params: HotelSearchParams): HotelResult[] {
  const rawResults = data?.HotelSearchResult?.HotelResults || data?.HotelSearchResult?.HotelResult || data?.HotelResults || [];

  const currency = data?.HotelSearchResult?.PreferredCurrency || data?.HotelSearchResult?.Currency || "INR";

  const mapped: HotelResult[] = [];
  for (const r of Array.isArray(rawResults) ? rawResults : []) {
    const hotelName = r?.HotelName || r?.HotelDetails?.HotelName || "Hotel";
    const cityName = params.cityName;
    const publishedRoundedOff =
      typeof r?.Price === "object" && r.Price !== null
        ? (r.Price as { PublishedPriceRoundedOff?: number | string }).PublishedPriceRoundedOff
        : undefined;

    const minPrice = r?.MinHotelPrice?.TotalPrice ?? r?.MinHotelPrice?.Price ?? publishedRoundedOff ?? r?.Price ?? 0;

    const original = r?.MinHotelPrice?.OriginalPrice ?? r?.MinHotelPrice?.OfferedPrice ?? r?.OriginalPrice ?? undefined;

    mapped.push({
      resultIndex: safeNumber(r?.ResultIndex, mapped.length + 1),
      hotelCode: String(r?.HotelCode || r?.HotelDetails?.HotelCode || ""),
      hotelName,
      hotelImage: r?.HotelPicture || r?.HotelImage || "",
      hotelDescription: r?.HotelDescription || "",
      address: r?.HotelAddress || r?.Address || "",
      rating: String(r?.StarRating || r?.HotelCategory || ""),
      tripAdvisorRating: r?.TripAdvisorRating ? String(r.TripAdvisorRating) : undefined,
      price: Math.round(safeNumber(minPrice, 0)),
      currency: String(r?.MinHotelPrice?.Currency || currency || "INR"),
      originalPrice: original !== undefined ? Math.round(safeNumber(original, 0)) : undefined,
      isRefundable: r?.IsRefundable ?? undefined,
      mealType: r?.MealType ?? undefined,
      redirectUrl: buildHotelRedirectUrl(hotelName, cityName),
    });
  }

  if (params.budgetMax && params.budgetMax > 0) {
    return mapped.filter((h) => h.price <= params.budgetMax!);
  }
  return mapped;
}

/** =========================
 * TBOH Hotel API v2.1 (REST)
 * ========================= */
async function callTBOHotelSearch(params: HotelSearchParams): Promise<HotelResult[]> {
  if (!TBO_HOTEL_USERNAME || !TBO_HOTEL_PASSWORD) {
    throw new Error("Missing TBO hotel credentials (TBO_HOTEL_USERNAME / TBO_HOTEL_PASSWORD).");
  }

  let hotelCodes =
    typeof params.hotelCodes === "string"
      ? params.hotelCodes
      : Array.isArray(params.hotelCodes)
        ? params.hotelCodes.join(",")
        : "";

  if (!hotelCodes) {
    const demoCodes = getDemoHotelCodes(params.cityName);
    if (demoCodes.length > 0) {
      hotelCodes = demoCodes.join(",");
    }
  }

  if (!hotelCodes) {
    const derivedCodes = await fetchHotelCodesForCity(params.cityName);
    if (derivedCodes.length > 0) {
      hotelCodes = derivedCodes.join(",");
    }
  }

  // Real API expects HotelCodes. If not available, fail fast (wrapper will fall back to mock)
  if (!hotelCodes) {
    throw new Error(
      `HotelCodes missing for "${params.cityName}". Provide params.hotelCodes or valid TBO hotel static-data credentials.`
    );
  }

  const rooms = Math.max(1, params.rooms ?? 1);
  const adults = Math.max(1, params.adults || 2);
  const children = Math.max(0, params.children ?? 0);

  // PaxRooms array (v2.1)
  const paxRooms = Array.from({ length: rooms }).map(() => ({
    Adults: adults,
    Children: children,
    ChildrenAges:
      children > 0
        ? (params.childrenAges && params.childrenAges.length === children
            ? params.childrenAges
            : Array.from({ length: children }).map(() => 5))
        : [],
  }));
  const codeList = hotelCodes
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, MAX_HOTEL_CODES);
  const codeBatches: string[][] = [];
  for (let i = 0; i < codeList.length; i += 30) {
    codeBatches.push(codeList.slice(i, i + 30));
  }
  const batches = codeBatches.length > 0 ? codeBatches : [[hotelCodes]];

  const dayOffsets = TBO_HOTEL_FLEX_SEARCH_ENABLED ? TBO_HOTEL_FLEX_DAY_OFFSETS : [0];
  const responseTime = Math.max(5, Math.min(23, params.responseTimeSeconds ?? 12));
  let hadOkResponse = false;
  let lastError: unknown = null;

  for (const offset of dayOffsets) {
    const relaxed = offset !== 0;
    const checkIn = offset === 0 ? params.checkIn : shiftIsoDate(params.checkIn, offset);
    const checkOut = offset === 0 ? params.checkOut : shiftIsoDate(params.checkOut, offset);

    for (const batch of batches) {
      const body = {
        CheckIn: checkIn,
        CheckOut: checkOut,
        HotelCodes: batch.join(","),
        GuestNationality: params.guestNationality || "IN",
        PaxRooms: paxRooms,
        ResponseTime: responseTime,
        IsDetailedResponse: params.isDetailedResponse ?? false,
        Filters: {
          Refundable: relaxed ? false : Boolean(params.refundable),
          NoOfRooms: relaxed ? 0 : params.noOfRoomsFilter ?? 0,
          MealType: relaxed ? "All" : params.mealType ?? "All",
        },
      };

      try {
        const res = await fetch(`${TBO_HOTEL_BASE_URL}/Search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: basicAuthHeader(TBO_HOTEL_USERNAME, TBO_HOTEL_PASSWORD),
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TBO_HOTEL_SEARCH_TIMEOUT_MS),
        });

        const text = await res.text();
        if (!res.ok) {
          throw new Error(`TBOH Search failed (${res.status}): ${text.slice(0, 200)}`);
        }

        hadOkResponse = true;
        const data = text ? JSON.parse(text) : {};
        const mapped = mapTBOHotelSearchResults(data, params);
        if (mapped.length > 0) {
          return mapped;
        }
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (!hadOkResponse && lastError) {
    throw lastError;
  }

  return [];
}

/** =========================
 * TBO AIR (Optional) + mock fallback
 * ========================= */
const TBO_AIR_URL = stripTrailingSlash(process.env.TBO_AIR_URL || "");
const TBO_AIR_USERNAME = process.env.TBO_AIR_USERNAME || "";
const TBO_AIR_PASSWORD = process.env.TBO_AIR_PASSWORD || "";
const TBO_AIR_CLIENT_ID = process.env.TBO_AIR_CLIENT_ID || "ApiIntegrationNew";
const TBO_END_USER_IP = process.env.TBO_END_USER_IP || "103.210.34.74";
const TBO_B2B_URL = stripTrailingSlash(process.env.TBO_B2B_URL || "");

const TBO_AIR_AUTH_URL =
  process.env.TBO_AIR_AUTH_URL ||
  (TBO_AIR_URL
    ? /SharedData\.svc\/rest\/Authenticate$/i.test(TBO_AIR_URL)
      ? TBO_AIR_URL
      : /sharedapi\.tektravels\.com/i.test(TBO_AIR_URL)
        ? `${TBO_AIR_URL}/SharedData.svc/rest/Authenticate`
        : "http://Sharedapi.tektravels.com/SharedData.svc/rest/Authenticate"
    : "http://Sharedapi.tektravels.com/SharedData.svc/rest/Authenticate");
const TBO_AIR_VALIDATE_AGENCY_URL =
  process.env.TBO_AIR_VALIDATE_AGENCY_URL ||
  (TBO_B2B_URL ? `${TBO_B2B_URL}/Authenticate/ValidateAgency` : "");

const TBO_AIR_SEARCH_URL =
  process.env.TBO_AIR_SEARCH_URL ||
  (TBO_AIR_URL
    ? /BookingEngineService_Air\/AirService\.svc\/rest\/Search$/i.test(TBO_AIR_URL)
      ? TBO_AIR_URL
      : `${TBO_AIR_URL}/BookingEngineService_Air/AirService.svc/rest/Search`
    : "http://api.tektravels.com/BookingEngineService_Air/AirService.svc/rest/Search");
const TBO_AIR_SEARCH_ALT_URL = process.env.TBO_AIR_SEARCH_ALT_URL || "";

function timeHHMM(value: string | undefined): string {
  if (!value) return "";
  const [, timePart = ""] = value.split("T");
  return timePart.slice(0, 5);
}

function formatMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem}m`;
}

function getDurationFromSegments(
  segments: Array<{ Duration?: number | string; Origin?: { DepTime?: string }; Destination?: { ArrTime?: string } }>
): string {
  const bySegmentDuration = segments.reduce((sum, seg) => sum + safeNumber(seg?.Duration, 0), 0);
  if (bySegmentDuration > 0) {
    return formatMinutes(bySegmentDuration);
  }

  const dep = segments[0]?.Origin?.DepTime;
  const arr = segments[segments.length - 1]?.Destination?.ArrTime;
  if (dep && arr) {
    const depMs = new Date(dep).getTime();
    const arrMs = new Date(arr).getTime();
    if (Number.isFinite(depMs) && Number.isFinite(arrMs) && arrMs > depMs) {
      return formatMinutes((arrMs - depMs) / (1000 * 60));
    }
  }

  return "";
}

type AirAuthResponse = {
  TokenId?: string | number;
  Response?: {
    TokenId?: string | number;
    Error?: { ErrorMessage?: string; Message?: string; Description?: string };
  };
  Token?: { TokenId?: string | number };
  Data?: { TokenId?: string | number };
  Status?: { Success?: boolean; Message?: string; Description?: string };
  Error?: { ErrorMessage?: string; Message?: string; Description?: string };
};

type AirSearchSegment = {
  Duration?: number | string;
  Origin?: { DepTime?: string; Airport?: { AirportCode?: string } };
  Destination?: { ArrTime?: string; Airport?: { AirportCode?: string } };
  Airline?: { AirlineName?: string; AirlineCode?: string; FlightNumber?: string | number };
};

type AirSearchResultItem = {
  Segments?: AirSearchSegment[][];
  Fare?: {
    PublishedFare?: number | string;
    OfferedFare?: number | string;
    BaseFare?: number | string;
  };
};

type AirSearchPayload = {
  Response?: {
    Error?: {
      ErrorCode?: number | string;
      ErrorMessage?: string;
    };
    Results?: unknown; // allow dynamic result shapes
  };
};

async function postAirJson(url: string, body: Record<string, unknown>, headers?: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`${url} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return data;
}

function readAirTokenId(data: AirAuthResponse): string {
  const token = data.TokenId || data.Response?.TokenId || data.Token?.TokenId || data.Data?.TokenId || "";
  return String(token).trim();
}

function readAirAuthMessage(data: AirAuthResponse): string {
  const msg =
    data.Error?.ErrorMessage ||
    data.Error?.Message ||
    data.Error?.Description ||
    data.Response?.Error?.ErrorMessage ||
    data.Response?.Error?.Message ||
    data.Response?.Error?.Description ||
    data.Status?.Message ||
    data.Status?.Description ||
    "";
  return String(msg).trim();
}

async function getTBOAirToken(): Promise<string> {
  const ip = process.env.TBO_END_USER_IP || "127.0.0.1";
  const authCandidates = Array.from(
    new Set(
      [
        TBO_AIR_VALIDATE_AGENCY_URL,
        TBO_AIR_AUTH_URL,
        TBO_AIR_URL ? `${TBO_AIR_URL}/Authenticate/ValidateAgency` : "",
        TBO_AIR_URL ? `${TBO_AIR_URL}/SharedData.svc/rest/Authenticate` : "",
        "http://Sharedapi.tektravels.com/SharedData.svc/rest/Authenticate",
      ].filter(Boolean)
    )
  );

  const payloadCandidates: Array<Record<string, unknown>> = [
    {
      BookingMode: "API",
      ClientId: TBO_AIR_CLIENT_ID,
      UserName: TBO_AIR_USERNAME,
      Password: TBO_AIR_PASSWORD,
      IPAddress: ip,
    },
    {
      ClientId: TBO_AIR_CLIENT_ID,
      UserName: TBO_AIR_USERNAME,
      Password: TBO_AIR_PASSWORD,
      EndUserIp: ip,
      IPAddress: ip,
    },
    {
      ClientId: TBO_AIR_CLIENT_ID,
      Username: TBO_AIR_USERNAME,
      Password: TBO_AIR_PASSWORD,
      EndUserIp: ip,
      IPAddress: ip,
    },
  ];

  const errors: string[] = [];

  for (const authUrl of authCandidates) {
    for (const payload of payloadCandidates) {
      try {
        const res = await fetch(authUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(12000),
        });

        const text = await res.text();
        if (!res.ok) {
          errors.push(`${authUrl} (${res.status})`);
          continue;
        }

        let data: AirAuthResponse;
        try {
          data = (text ? JSON.parse(text) : {}) as AirAuthResponse;
        } catch {
          errors.push(`${authUrl} returned non-JSON: ${text.slice(0, 80)}`);
          continue;
        }

        const tokenId = readAirTokenId(data);
        if (tokenId) return tokenId;

        const hint = readAirAuthMessage(data);
        errors.push(hint ? `${authUrl}: ${hint}` : `${authUrl}: TokenId missing`);
      } catch (error) {
        errors.push(`${authUrl}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  throw new Error(`Air auth failed: ${errors.slice(0, 6).join(" | ")}`);
}

// Collect result rows from variable response shapes.
function collectAirResultItems(results: unknown): AirSearchResultItem[] {
  const items: AirSearchResultItem[] = [];

  const pushIfItem = (x: unknown) => {
    if (x && typeof x === "object") items.push(x as AirSearchResultItem);
  };

  const ingestGroup = (group: unknown) => {
    if (!group) return;

    if (Array.isArray(group)) {
      for (const g of group) pushIfItem(g);
      return;
    }

    if (typeof group === "object") {
      const rec = group as Record<string, unknown>;

      const maybeResult = rec.Result;
      if (Array.isArray(maybeResult)) {
        for (const g of maybeResult) pushIfItem(g);
        return;
      }

      const values = Object.values(rec);
      const hasArray = values.some((v) => Array.isArray(v));
      if (hasArray) {
        for (const v of values) ingestGroup(v);
        return;
      }

      pushIfItem(group);
    }
  };

  if (Array.isArray(results)) {
    for (const r of results) ingestGroup(r);
    return items;
  }

  if (results && typeof results === "object") {
    ingestGroup(results);
  }

  return items;
}

// Parse flight results with support for variable segment shapes.
function parseAirSearchResults(data: AirSearchPayload, from: string, to: string, date: string): FlightResult[] {
  const response = data?.Response;
  const errorCode = safeNumber(response?.Error?.ErrorCode, 0);
  if (errorCode !== 0) {
    if (errorCode === 25) return [];
    const msg = response?.Error?.ErrorMessage || "Unknown search error";
    throw new Error(`TBO Air search error (${errorCode}): ${msg}`);
  }

  const all: AirSearchResultItem[] = collectAirResultItems((response as { Results?: unknown })?.Results);
  if (all.length === 0) return [];

  const results: FlightResult[] = [];

  for (const r of all) {
    const segsAny: unknown = r?.Segments;
    const journeySegments: AirSearchSegment[] =
      Array.isArray(segsAny)
        ? Array.isArray(segsAny[0])
          ? (segsAny[0] as AirSearchSegment[])
          : (segsAny as AirSearchSegment[])
        : [];

    const firstSeg = journeySegments[0];
    const lastSeg = journeySegments[journeySegments.length - 1];
    if (!firstSeg || !lastSeg) continue;

    const fromCode = firstSeg?.Origin?.Airport?.AirportCode || from;
    const toCode = lastSeg?.Destination?.Airport?.AirportCode || to;
    const stopsCount = Math.max(0, journeySegments.length - 1);

    const fare =
      safeNumber(r?.Fare?.PublishedFare, 0) ||
      safeNumber(r?.Fare?.OfferedFare, 0) ||
      safeNumber(r?.Fare?.BaseFare, 0);

    if (fare <= 0) continue;

    results.push({
      airline: firstSeg?.Airline?.AirlineName || "Unknown",
      flightCode: `${firstSeg?.Airline?.AirlineCode || ""}-${firstSeg?.Airline?.FlightNumber || ""}`,
      from: fromCode,
      to: toCode,
      departure: timeHHMM(firstSeg?.Origin?.DepTime),
      arrival: timeHHMM(lastSeg?.Destination?.ArrTime),
      duration: getDurationFromSegments(journeySegments),
      price: Math.round(fare),
      stops: stopsCount > 0 ? `${stopsCount} stop${stopsCount > 1 ? "s" : ""}` : "Non-stop",
      redirectUrl: buildFlightRedirectUrl(fromCode, toCode, date),
    });
  }

  const deduped = Array.from(
    new Map(results.map((r) => [`${r.flightCode}-${r.departure}-${r.arrival}-${r.price}`, r])).values()
  );
  deduped.sort((a, b) => a.price - b.price);
  if (deduped[0]) deduped[0].tag = "Cheapest";
  return deduped.slice(0, 8);
}

// Search with a conservative payload set and fallback source hints.
async function callTBOAirSearch(
  from: string,
  to: string,
  date: string,
  adults: number,
  children: number,
  tokenId: string
): Promise<FlightResult[]> {
  const basePayload = {
    EndUserIp: TBO_END_USER_IP,
    TokenId: tokenId,
    AdultCount: String(Math.max(1, adults)),
    ChildCount: String(Math.max(0, children)),
    InfantCount: "0",

    // Important knobs (commonly required in working setups)
    IsDomestic: "true",
    BookingMode: "5",
    DirectFlight: "false",
    OneStopFlight: "false",
    JourneyType: "1",
    ResultFareType: 0,
    PreferredCurrency: "INR",

    Segments: [
      {
        Origin: from,
        Destination: to,
        FlightCabinClass: 1, // numeric is safer
        PreferredDepartureTime: `${date}T00:00:00`,
        PreferredArrivalTime: `${date}T00:00:00`,
      },
    ],
  };

  const payloads: Array<Record<string, unknown>> = [
    { ...basePayload, PreferredAirlines: null, Sources: null },
    { ...basePayload, PreferredAirlines: ["SG"], Sources: ["SG"] },
  ];

  const urls = Array.from(new Set([TBO_AIR_SEARCH_URL, TBO_AIR_SEARCH_ALT_URL].filter(Boolean)));
  const errors: string[] = [];

  for (const url of urls) {
    for (const payload of payloads) {
      try {
        const data = await postAirJson(url, payload, { TokenId: tokenId });
        const parsed = parseAirSearchResults(data, from, to, date);
        if (parsed.length > 0) return parsed;
      } catch (error) {
        errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  if (errors.length > 0) throw new Error(errors.join(" | "));
  return [];
}

// City name → IATA code map
const CITY_TO_IATA: Record<string, string> = {
  Delhi: "DEL",
  "New Delhi": "DEL",
  Mumbai: "BOM",
  Goa: "GOI",
  Bangalore: "BLR",
  Bengaluru: "BLR",
  Amritsar: "ATQ",
  Chandigarh: "IXC",
  Srinagar: "SXR",
  Chennai: "MAA",
  Madras: "MAA",
  Kolkata: "CCU",
  Hyderabad: "HYD",
  Kochi: "COK",
  Jaipur: "JAI",
  Ahmedabad: "AMD",
  Pune: "PNQ",
  Bhopal: "BHO",
  Varanasi: "VNS",
  Udaipur: "UDR",
  Dubai: "DXB",
  Singapore: "SIN",
  Bangkok: "BKK",
  Bali: "DPS",
  London: "LHR",
  Paris: "CDG",
};

const FLIGHT_ROUTE_BASE_MINUTES: Record<string, number> = {
  "DEL-GOI": 150,
  "DEL-ATQ": 70,
  "DEL-IXC": 55,
  "DEL-JAI": 60,
  "DEL-BOM": 130,
  "DEL-BLR": 165,
  "DEL-MAA": 170,
  "DEL-CCU": 125,
  "DEL-HYD": 140,
  "DEL-COK": 185,
  "DEL-SXR": 95,
  "BOM-GOI": 70,
  "BOM-BLR": 95,
  "BOM-MAA": 115,
  "BLR-MAA": 60,
  "BLR-COK": 65,
  "MAA-CCU": 130,
  "DXB-BOM": 190,
  "DXB-DEL": 210,
  "SIN-BKK": 145,
};

function toIATA(city: string): string {
  const trimmed = city.trim();
  if (!trimmed) return "XXX";

  const direct = CITY_TO_IATA[trimmed];
  if (direct) return direct;

  const lower = trimmed.toLowerCase();
  const ciMatch = Object.entries(CITY_TO_IATA).find(([name]) => name.toLowerCase() === lower)?.[1];
  if (ciMatch) return ciMatch;

  return trimmed.slice(0, 3).toUpperCase();
}

function flightRouteKey(fromCode: string, toCode: string): string {
  return `${fromCode}-${toCode}`;
}

function routeHash(fromCode: string, toCode: string): number {
  const s = `${fromCode}-${toCode}`;
  let total = 0;
  for (let i = 0; i < s.length; i += 1) total += s.charCodeAt(i) * (i + 1);
  return total;
}

function getMockBaseFlightMinutes(fromCode: string, toCode: string): number {
  const direct = FLIGHT_ROUTE_BASE_MINUTES[flightRouteKey(fromCode, toCode)];
  if (direct) return direct;
  const reverse = FLIGHT_ROUTE_BASE_MINUTES[flightRouteKey(toCode, fromCode)];
  if (reverse) return reverse;
  return 85 + (routeHash(fromCode, toCode) % 165);
}

function addTimeLabel(hhmm: string, minutesToAdd: number): string {
  const [hRaw, mRaw] = hhmm.split(":");
  const startMin = Number(hRaw || 0) * 60 + Number(mRaw || 0);
  const total = startMin + Math.max(0, Math.round(minutesToAdd));
  const dayOffset = Math.floor(total / (24 * 60));
  const inDay = total % (24 * 60);
  const h = String(Math.floor(inDay / 60)).padStart(2, "0");
  const m = String(inDay % 60).padStart(2, "0");
  return dayOffset > 0 ? `${h}:${m}+${dayOffset}` : `${h}:${m}`;
}

function minutesToDurationLabel(totalMinutes: number): string {
  const mins = Math.max(30, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

/** =========================
 * Mock data
 * ========================= */
function getMockHotels(destination: string): HotelResult[] {
  const dest = destination.split(",")[0].trim();
  return [
    {
      resultIndex: 1,
      hotelCode: "1001",
      hotelName: `Taj Hotel ${dest}`,
      hotelImage: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
      hotelDescription: `Luxury 5-star property in the heart of ${dest} offering world-class amenities.`,
      address: `Main Road, ${dest}`,
      rating: "FiveStar",
      tripAdvisorRating: "4.8",
      price: 12500,
      currency: "INR",
      originalPrice: 18900,
      isRefundable: true,
      mealType: "WithMeal",
      amenities: ["breakfast", "free_wifi", "pool_spa", "gym"],
      redirectUrl: buildHotelRedirectUrl(`Taj Hotel ${dest}`, dest),
    },
    {
      resultIndex: 2,
      hotelCode: "1002",
      hotelName: `Marriott ${dest}`,
      hotelImage: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
      hotelDescription: `Premium business and leisure hotel with excellent pool & spa in ${dest}.`,
      address: `Hotel District, ${dest}`,
      rating: "FiveStar",
      tripAdvisorRating: "4.6",
      price: 8900,
      currency: "INR",
      originalPrice: 13500,
      isRefundable: false,
      mealType: "RoomOnly",
      amenities: ["free_wifi", "gym"],
      redirectUrl: buildHotelRedirectUrl(`Marriott ${dest}`, dest),
    },
    {
      resultIndex: 3,
      hotelCode: "1003",
      hotelName: `Ibis ${dest}`,
      hotelImage: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
      hotelDescription: `Smart budget hotel with modern rooms and complimentary Wi-Fi.`,
      address: `Budget Zone, ${dest}`,
      rating: "ThreeStar",
      tripAdvisorRating: "4.2",
      price: 3200,
      currency: "INR",
      originalPrice: 4500,
      isRefundable: true,
      mealType: "RoomOnly",
      amenities: ["free_wifi"],
      redirectUrl: buildHotelRedirectUrl(`Ibis ${dest}`, dest),
    },
    {
      resultIndex: 4,
      hotelCode: "1004",
      hotelName: `Heritage Haveli ${dest}`,
      hotelImage: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1200&q=80",
      hotelDescription: `Boutique heritage property blending traditional architecture with modern comfort.`,
      address: `Old City, ${dest}`,
      rating: "FourStar",
      tripAdvisorRating: "4.9",
      price: 6200,
      currency: "INR",
      originalPrice: 8800,
      isRefundable: false,
      mealType: "WithMeal",
      amenities: ["breakfast", "pool_spa"],
      redirectUrl: buildHotelRedirectUrl(`Heritage Haveli ${dest}`, dest),
    },
    {
      resultIndex: 5,
      hotelCode: "1005",
      hotelName: `Lemon Tree ${dest}`,
      hotelImage: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
      hotelDescription: `Cheerful upscale midscale hotel ideal for families.`,
      address: `Central ${dest}`,
      rating: "FourStar",
      tripAdvisorRating: "4.4",
      price: 5100,
      currency: "INR",
      originalPrice: 7200,
      isRefundable: true,
      mealType: "WithMeal",
      amenities: ["breakfast", "free_wifi", "gym"],
      redirectUrl: buildHotelRedirectUrl(`Lemon Tree ${dest}`, dest),
    },
  ];
}

function getMockFlights(from: string, to: string, dateISO?: string): FlightResult[] {
  const fromCode = toIATA(from);
  const toCode = toIATA(to);
  const base = getMockBaseFlightMinutes(fromCode, toCode);
  const hash = routeHash(fromCode, toCode);

  const nonStop1 = Math.max(45, base - 10);
  const nonStop2 = base + 5;
  const oneStop1 = base + 55 + (hash % 30);
  const oneStop2 = base + 85 + (hash % 40);

  const dep1 = "06:15";
  const dep2 = "10:30";
  const dep3 = "14:00";
  const dep4 = "18:20";

  return [
    {
      airline: "IndiGo",
      flightCode: "6E-2145",
      from: fromCode,
      to: toCode,
      departure: dep1,
      arrival: addTimeLabel(dep1, nonStop1),
      duration: minutesToDurationLabel(nonStop1),
      price: 4299,
      stops: "Non-stop",
      tag: "Cheapest",
      redirectUrl: buildFlightRedirectUrl(fromCode, toCode, dateISO),
    },
    {
      airline: "Air India",
      flightCode: "AI-883",
      from: fromCode,
      to: toCode,
      departure: dep2,
      arrival: addTimeLabel(dep2, nonStop2),
      duration: minutesToDurationLabel(nonStop2),
      price: 5899,
      stops: "Non-stop",
      tag: "Best rated",
      redirectUrl: buildFlightRedirectUrl(fromCode, toCode, dateISO),
    },
    {
      airline: "Vistara",
      flightCode: "UK-857",
      from: fromCode,
      to: toCode,
      departure: dep3,
      arrival: addTimeLabel(dep3, oneStop1),
      duration: minutesToDurationLabel(oneStop1),
      price: 6450,
      stops: "1 stop",
      redirectUrl: buildFlightRedirectUrl(fromCode, toCode, dateISO),
    },
    {
      airline: "SpiceJet",
      flightCode: "SG-123",
      from: fromCode,
      to: toCode,
      departure: dep4,
      arrival: addTimeLabel(dep4, oneStop2),
      duration: minutesToDurationLabel(oneStop2),
      price: 3850,
      stops: "1 stop",
      redirectUrl: buildFlightRedirectUrl(fromCode, toCode, dateISO),
    },
  ];
}

/** =========================
 * Public API
 * ========================= */
export async function searchHotels(params: HotelSearchParams): Promise<HotelResult[]> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));
    setHotelInventoryDebug(params.cityName, "demo-mock", "USE_MOCK_DATA=true");
    return getMockHotels(params.cityName);
  }

  if (TBO_HOTEL_CATALOG_ONLY) {
    const staticCatalog = await fetchStaticHotelCatalogForCity(params.cityName);
    const staticFiltered =
      params.budgetMax && params.budgetMax > 0
        ? staticCatalog.filter((h) => h.price <= params.budgetMax!)
        : staticCatalog;
    if (staticFiltered.length > 0) {
      setHotelInventoryDebug(
        params.cityName,
        "static-catalog",
        "Catalog-only mode enabled; listing hotels from TBOHotelCodeList (date-agnostic)."
      );
      return staticFiltered;
    }
    setHotelInventoryDebug(params.cityName, "demo-mock", "Catalog-only mode enabled but static catalog empty");
    return getMockHotels(params.cityName);
  }

  try {
    const hotels = await callTBOHotelSearch(params);
    if (hotels.length === 0) {
      const staticCatalog = await fetchStaticHotelCatalogForCity(params.cityName);
      const staticFiltered =
        params.budgetMax && params.budgetMax > 0
          ? staticCatalog.filter((h) => h.price <= params.budgetMax!)
          : staticCatalog;
      if (staticFiltered.length > 0) {
        const key = `static:${normalizeLocationName(params.cityName)}`;
        if (!HOTEL_FALLBACK_LOGGED.has(key)) {
          HOTEL_FALLBACK_LOGGED.add(key);
          console.warn(`TBO Hotel API returned empty inventory (${params.cityName}); using TBO static catalog fallback.`);
        }
        setHotelInventoryDebug(params.cityName, "static-catalog", "Search empty; used TBOHotelCodeList catalog");
        return staticFiltered;
      }

      const key = `mock:${normalizeLocationName(params.cityName)}`;
      if (!HOTEL_FALLBACK_LOGGED.has(key)) {
        HOTEL_FALLBACK_LOGGED.add(key);
        console.warn(`TBO Hotel API returned empty inventory (${params.cityName}); falling back to demo hotels.`);
      }
      setHotelInventoryDebug(params.cityName, "demo-mock", "Search empty and static catalog unavailable");
      return getMockHotels(params.cityName);
    }
    setHotelInventoryDebug(params.cityName, "live", "TBO Search returned inventory");
    return hotels;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const staticCatalog = await fetchStaticHotelCatalogForCity(params.cityName);
    const staticFiltered =
      params.budgetMax && params.budgetMax > 0
        ? staticCatalog.filter((h) => h.price <= params.budgetMax!)
        : staticCatalog;

    if (staticFiltered.length > 0) {
      const key = `error-static:${normalizeLocationName(params.cityName)}`;
      if (!HOTEL_FALLBACK_LOGGED.has(key)) {
        HOTEL_FALLBACK_LOGGED.add(key);
        console.warn(`TBO Hotel API error (${params.cityName}): ${message}. Using TBO static catalog fallback.`);
      }
      setHotelInventoryDebug(params.cityName, "static-catalog", `Search error: ${message}`);
      return staticFiltered;
    }

    const key = `error-mock:${message}`;
    if (!HOTEL_FALLBACK_LOGGED.has(key)) {
      HOTEL_FALLBACK_LOGGED.add(key);
      console.warn(`TBO Hotel API fallback (${params.cityName}): ${message}`);
    }
    setHotelInventoryDebug(params.cityName, "demo-mock", `Search error: ${message}`);
    return getMockHotels(params.cityName);
  }
}

/**
 * Flights search (single export)
 * - If USE_MOCK_DATA=true OR Air credentials missing -> returns mock
 * - Else calls TekTravel Air API and falls back to mock on error/no inventory
 */
export async function searchFlights(
  from: string,
  to: string,
  date?: string,
  adults = 2,
  children = 0
): Promise<FlightResult[]> {
  const normalizedFrom = from.trim();
  const normalizedTo = to.trim();
  if (!normalizedFrom || !normalizedTo) return [];

  const flightDate =
    date ||
    (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().split("T")[0];
    })();

  if (USE_MOCK || !TBO_AIR_USERNAME || !TBO_AIR_PASSWORD) {
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 300));
    setAirInventoryDebug(
      normalizedFrom,
      normalizedTo,
      flightDate,
      "demo-mock",
      USE_MOCK ? "USE_MOCK_DATA=true" : "Missing TBO air credentials"
    );
    return getMockFlights(normalizedFrom, normalizedTo, flightDate);
  }

  try {
    const token = await getTBOAirToken();
    const fromIATA = toIATA(normalizedFrom);
    const toIATA2 = toIATA(normalizedTo);
    const real = await callTBOAirSearch(fromIATA, toIATA2, flightDate, adults, children, token);
    if (real.length > 0) {
      setAirInventoryDebug(normalizedFrom, normalizedTo, flightDate, "live", "TBO Air API returned inventory");
      return real;
    }
    const key = `${fromIATA}-${toIATA2}`;
    if (!AIR_NO_RESULT_LOGGED.has(key)) {
      AIR_NO_RESULT_LOGGED.add(key);
      console.warn(`TBO Air API returned no inventory (${fromIATA} -> ${toIATA2}); falling back to demo flights.`);
    }
    setAirInventoryDebug(
      normalizedFrom,
      normalizedTo,
      flightDate,
      "demo-mock",
      `TBO Air returned no inventory (${fromIATA} -> ${toIATA2})`
    );
    return getMockFlights(normalizedFrom, normalizedTo, flightDate);
  } catch (err) {
    console.error("TBO Air API error, falling back to mock:", err);
    const reason = err instanceof Error ? err.message : String(err);
    setAirInventoryDebug(normalizedFrom, normalizedTo, flightDate, "demo-mock", `TBO Air error: ${reason}`);
    return getMockFlights(normalizedFrom, normalizedTo, flightDate);
  }
}
