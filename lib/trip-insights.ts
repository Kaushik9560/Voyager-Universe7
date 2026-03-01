export interface FarePoint {
  date: string;
  price: number;
}

export interface PriceForecastSection {
  currency: string;
  outlook: string;
  note: string;
  daily: FarePoint[];
}

export interface FlightPriceForecast extends PriceForecastSection {
  currentBestPrice: number;
}

export interface TrainPriceForecast extends PriceForecastSection {
  estimatedRange: {
    min: number;
    max: number;
  };
}

export interface WeatherTrendDay {
  date: string;
  minTemp: number;
  maxTemp: number;
  precipitationChance: number;
  summary: string;
}

export interface WeatherTrend {
  destination: string;
  climateTag: string;
  summary: string;
  days: WeatherTrendDay[];
}

export interface CategorizedPlace {
  title: string;
  area: string;
  reason: string;
  estimatedCost: number | null;
}

export interface PlaceCategories {
  adventure: CategorizedPlace[];
  trek: CategorizedPlace[];
  sunriseSunset: CategorizedPlace[];
  activity: CategorizedPlace[];
  kidFriendly: CategorizedPlace[];
  shopping: CategorizedPlace[];
  allRound: CategorizedPlace[];
}

export interface MedicalKit {
  climateTag: string;
  mustCarry: string[];
  optional: string[];
  caution: string[];
}

export interface FoodPlaceSummary {
  name: string;
  cuisine: string;
  area: string;
  priceEstimate: number;
  vegOnly: boolean;
  rating: number;
}

export interface FoodGuide {
  vegOnly: FoodPlaceSummary[];
  multiCuisine: FoodPlaceSummary[];
  note: string;
}

export interface TripInsightsPayload {
  generatedAt: string;
  priceForecast: {
    flight: FlightPriceForecast;
    train: TrainPriceForecast;
  };
  weatherTrend: WeatherTrend;
  placeCategories: PlaceCategories;
  medicalKit: MedicalKit;
  foodGuide: FoodGuide;
}
