export interface ResultsSummary {
  flights: Array<{
    airline: string;
    flightCode: string;
    from: string;
    to: string;
    departure: string;
    arrival: string;
    price: number;
    stops: string;
  }>;
  hotels: Array<{
    hotelName: string;
    price: number;
    rating: string | null;
    address: string | null;
  }>;
  activities: Array<{
    title: string;
    area: string | null;
    price?: number;
  }>;
  restaurants: Array<{
    title: string;
    cuisine?: string;
    area?: string;
  }>;
}

interface SearchLikeData {
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
  hotels?: Array<{
    hotelName?: string;
    price?: number;
    rating?: string;
    tripAdvisorRating?: string;
    address?: string;
  }>;
  activities?: Array<{
    name?: string;
    description?: string;
    price?: number;
  }>;
  restaurants?: Array<{
    name?: string;
    cuisine?: string;
    location?: string;
  }>;
}

function parseArea(raw?: string): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first || null;
}

export function buildResultsSummary(data: SearchLikeData | null | undefined): ResultsSummary | null {
  if (!data) return null;

  const flights = (data.flights || [])
    .slice(0, 5)
    .map((flight) => ({
      airline: flight.airline || "Unknown Airline",
      flightCode: flight.flightCode || "N/A",
      from: flight.from || "",
      to: flight.to || "",
      departure: flight.departure || "",
      arrival: flight.arrival || "",
      price: Number(flight.price || 0),
      stops: flight.stops || "N/A",
    }));

  const hotels = (data.hotels || [])
    .slice(0, 5)
    .map((hotel) => ({
      hotelName: hotel.hotelName || "Unknown Hotel",
      price: Number(hotel.price || 0),
      rating: hotel.tripAdvisorRating || hotel.rating || null,
      address: hotel.address || null,
    }));

  const activities = (data.activities || [])
    .slice(0, 5)
    .map((activity) => ({
      title: activity.name || "Activity",
      area: parseArea(activity.description),
      price: typeof activity.price === "number" ? activity.price : undefined,
    }));

  const restaurants = (data.restaurants || [])
    .slice(0, 5)
    .map((restaurant) => ({
      title: restaurant.name || "Restaurant",
      cuisine: restaurant.cuisine || undefined,
      area: parseArea(restaurant.location) || undefined,
    }));

  if (flights.length + hotels.length + activities.length + restaurants.length === 0) {
    return null;
  }

  return {
    flights,
    hotels,
    activities,
    restaurants,
  };
}
