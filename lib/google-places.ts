export type PlacePhoto = { name: string; widthPx?: number; heightPx?: number };
export type PlaceNew = {
  id?: string; // placeId
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string; // PRICE_LEVEL_*
  types?: string[];
  photos?: PlacePhoto[];
  regularOpeningHours?: { openNow?: boolean };
};

const PLACES_V1 = "https://places.googleapis.com/v1";

function getKey() {
  return process.env.GOOGLE_PLACES_API_KEY || "";
}

export function hasPlacesKey() {
  return Boolean(getKey());
}

// Photo URL format: /v1/{photo.name}/media?maxWidthPx=...
export function photoUrl(photoName: string, maxWidthPx = 1200) {
  const key = getKey();
  return `${PLACES_V1}/${encodeURIComponent(photoName)}/media?maxWidthPx=${maxWidthPx}&key=${encodeURIComponent(key)}`;
}

export function mapsRedirectUrl(placeId: string) {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

// Text Search
export async function searchText(params: {
  textQuery: string;
  includedType?: string; // restaurant | tourist_attraction | lodging
  languageCode?: string;
  maxResults?: number;
}): Promise<PlaceNew[]> {
  const key = getKey();
  if (!key) return [];

  const body: Record<string, unknown> = {
    textQuery: params.textQuery,
    languageCode: params.languageCode || "en",
    maxResultCount: Math.min(20, Math.max(1, params.maxResults ?? 12)),
  };
  if (params.includedType) body.includedType = params.includedType;

  const timeoutMs = Math.min(20000, Math.max(3000, Number(process.env.GOOGLE_PLACES_TIMEOUT_MS || 8000)));

  let res: Response;
  try {
    res = await fetch(`${PLACES_V1}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.types,places.photos,places.regularOpeningHours",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Places searchText network error (${params.textQuery}):`, message);
    return [];
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Places searchText failed:", res.status, txt.slice(0, 400));
    return [];
  }

  const json = (await res.json().catch(() => null)) as { places?: PlaceNew[] } | null;
  return Array.isArray(json?.places) ? json!.places! : [];
}
