import type { FlightResult, HotelResult } from "@/lib/tbo-api";
import type { ContentExtractionResult } from "@/lib/content-extractor";

export interface ActivityLite {
  name: string;
  category: string;
  price: number;
  description: string;
}

export interface RestaurantLite {
  name: string;
  cuisine: string;
  priceRange: string;
  veg: boolean;
  features: string[];
}

export interface RecommendationTrip {
  id: string;
  score: number;
  destination: string;
  durationDays: number;
  estimatedTotal: number;
  breakdown: {
    flight: number;
    hotel: number;
    activities: number;
    dining: number;
  };
  reasons: string[];
  flight: {
    airline: string;
    stops: string;
    departure: string;
    price: number;
  } | null;
  hotel: {
    name: string;
    rating: string | undefined;
    pricePerNight: number;
  } | null;
  activities: string[];
  restaurants: string[];
}

export interface RecommendationInput {
  destination: string;
  durationDays: number;
  flights: FlightResult[];
  hotels: HotelResult[];
  activities: ActivityLite[];
  restaurants: RestaurantLite[];
  extracted: ContentExtractionResult;
  budgetMax?: number;
  topK?: number;
}

function parseHotelRating(value: string | undefined): number {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("five") || raw === "5") return 5;
  if (raw.includes("four") || raw === "4") return 4;
  if (raw.includes("three") || raw === "3") return 3;
  if (raw.includes("two") || raw === "2") return 2;
  if (raw.includes("one") || raw === "1") return 1;
  return 3.5;
}

function diningPriceEstimate(priceRange: string): number {
  if (priceRange === "$") return 450;
  if (priceRange === "$$") return 900;
  return 1600;
}

function matchActivityScore(activities: ActivityLite[], interests: string[]): { names: string[]; score: number; cost: number } {
  if (activities.length === 0) return { names: [], score: 0, cost: 0 };

  const picks = activities
    .map((a) => {
      const hay = `${a.name} ${a.category} ${a.description}`.toLowerCase();
      const interestHits = interests.filter((interest) => hay.includes(interest.toLowerCase())).length;
      return { activity: a, hits: interestHits };
    })
    .sort((a, b) => b.hits - a.hits || a.activity.price - b.activity.price)
    .slice(0, 3);

  const names = picks.map((x) => x.activity.name);
  const cost = picks.reduce((sum, x) => sum + Math.max(0, Number(x.activity.price) || 0), 0);
  const hitCount = picks.reduce((sum, x) => sum + x.hits, 0);
  const score = interests.length > 0 ? Math.min(20, hitCount * 6) : Math.min(10, names.length * 3);
  return { names, score, cost };
}

function matchDining(restaurants: RestaurantLite[], extracted: ContentExtractionResult): { names: string[]; cost: number } {
  if (restaurants.length === 0) return { names: [], cost: 0 };

  const wantsVeg = extracted.interests.some((i) => i.type === "food") && /\bveg|vegetarian|jain\b/i.test(extracted.keywords.join(" "));
  const preferred = restaurants
    .filter((r) => !wantsVeg || r.veg || r.features.some((f) => /veg/i.test(f)))
    .slice(0, 2);
  const chosen = preferred.length > 0 ? preferred : restaurants.slice(0, 2);

  return {
    names: chosen.map((r) => r.name),
    cost: chosen.reduce((sum, r) => sum + diningPriceEstimate(r.priceRange), 0),
  };
}

function dedupeById(rows: RecommendationTrip[]): RecommendationTrip[] {
  const seen = new Set<string>();
  const out: RecommendationTrip[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

export function buildLightRecommendations(input: RecommendationInput): RecommendationTrip[] {
  const duration = Math.max(1, input.durationDays || 3);
  const topK = Math.max(1, Math.min(8, input.topK ?? 4));
  const interestTypes = Array.from(new Set(input.extracted.interests.map((i) => i.type.toLowerCase())));
  const budgetMax = input.extracted.budget.max ?? input.budgetMax ?? undefined;
  const budgetConstraint = input.extracted.budget.constraintType;

  const flights = input.flights.slice(0, 4);
  const hotels = input.hotels.slice(0, 6);
  const activities = input.activities.slice(0, 8);
  const restaurants = input.restaurants.slice(0, 8);

  const flightCandidates = flights.length > 0 ? flights : [null];
  const hotelCandidates = hotels.length > 0 ? hotels : [null];

  const trips: RecommendationTrip[] = [];
  let seed = 0;

  for (const flight of flightCandidates) {
    for (const hotel of hotelCandidates) {
      const flightCost = flight ? Math.max(0, Number(flight.price) || 0) : 0;
      const hotelNightCost = hotel ? Math.max(0, Number(hotel.price) || 0) : 0;
      const hotelCost = hotelNightCost * duration;

      const activityPack = matchActivityScore(activities, interestTypes);
      const diningPack = matchDining(restaurants, input.extracted);
      const estimatedTotal = Math.round(flightCost + hotelCost + activityPack.cost + diningPack.cost);

      if (budgetMax && budgetConstraint === "hard" && estimatedTotal > budgetMax) {
        continue;
      }

      let score = 50;
      const reasons: string[] = [];

      if (budgetMax) {
        const usage = (estimatedTotal / budgetMax) * 100;
        if (budgetConstraint === "optimize") {
          const bonus = Math.max(0, Math.round((100 - usage) * 0.35));
          score += bonus;
          reasons.push(`Budget optimized (${Math.round(usage)}% usage)`);
        } else if (usage <= 90) {
          score += 10;
          reasons.push(`Comfortably within budget (${Math.round(usage)}%)`);
        } else if (usage > 100) {
          score -= 16;
          reasons.push("Above budget");
        }
      }

      if (flight) {
        if (/non-?stop/i.test(flight.stops)) {
          score += 12;
          reasons.push("Direct flight convenience");
        } else {
          score -= 8;
          reasons.push("Layover included");
        }
      }

      if (hotel) {
        const rating = parseHotelRating(hotel.rating);
        const ratingBonus = Math.round((rating - 3) * 8);
        score += ratingBonus;
        reasons.push(`${rating.toFixed(1)} star stay option`);
      }

      score += activityPack.score;
      if (activityPack.names.length > 0) {
        reasons.push(`${activityPack.names.length} activity matches`);
      }

      if (restaurants.length > 0) {
        score += 4;
        reasons.push("Dining options included");
      }

      score = Math.max(35, Math.min(95, Math.round(score)));

      const trip: RecommendationTrip = {
        id: `reco_${seed += 1}_${flight?.flightCode || "no-flight"}_${hotel?.hotelCode || "no-hotel"}`,
        score,
        destination: input.destination,
        durationDays: duration,
        estimatedTotal,
        breakdown: {
          flight: Math.round(flightCost),
          hotel: Math.round(hotelCost),
          activities: Math.round(activityPack.cost),
          dining: Math.round(diningPack.cost),
        },
        reasons,
        flight: flight
          ? {
              airline: flight.airline,
              stops: flight.stops,
              departure: flight.departure,
              price: Math.round(flightCost),
            }
          : null,
        hotel: hotel
          ? {
              name: hotel.hotelName,
              rating: hotel.rating,
              pricePerNight: Math.round(hotelNightCost),
            }
          : null,
        activities: activityPack.names,
        restaurants: diningPack.names,
      };

      trips.push(trip);
    }
  }

  return dedupeById(trips).sort((a, b) => b.score - a.score).slice(0, topK);
}
