"use client";

import { Star, Clock, MapPin, Utensils, Leaf, Flame, BadgeCheck, Heart } from "lucide-react";

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
const DEFAULT_RESTAURANT_IMAGES = [
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=1200&q=80",
];

function hashSeed(value: string): number {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) total += value.charCodeAt(i) * (i + 1);
  return total;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border" style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}>
      <div className="h-20 w-full" style={{ background: "var(--secondary)" }} />
      <div className="p-3.5 space-y-2">
        <div className="h-3 w-2/3 rounded" style={{ background: "var(--secondary)" }} />
        <div className="h-2 w-full rounded" style={{ background: "var(--secondary)" }} />
        <div className="h-6 rounded" style={{ background: "var(--secondary)" }} />
      </div>
    </div>
  );
}

function PriceIndicator({ range }: { range: string }) {
  const filled = range.length;
  return (
    <span className="font-mono text-sm tracking-wide">
      {Array.from({ length: 3 }).map((_, i) => (
        <span key={i} style={{ color: i < filled ? "var(--accent)" : "oklch(0.5 0.02 260)" }}>₹</span>
      ))}
    </span>
  );
}

function RestaurantCard({ restaurant }: { restaurant: RestaurantResult }) {
  const fallbackStart = hashSeed(`${restaurant.name}-${restaurant.cuisine}`) % DEFAULT_RESTAURANT_IMAGES.length;
  const imageSrc = restaurant.imageUrl || DEFAULT_RESTAURANT_IMAGES[fallbackStart];
  const redirectUrl =
    restaurant.redirectUrl ||
    `https://www.google.com/search?q=${encodeURIComponent(`${restaurant.name} ${restaurant.location} official website`)}`;

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-xl border transition-all hover:scale-[1.02] hover:-translate-y-0.5"
      style={{ borderColor: "var(--glass-border)", background: "var(--glass)", backdropFilter: "blur(8px)" }}
    >
      {restaurant.tag && (
        <span className="absolute top-2 left-2 z-10 rounded-full px-2 py-0.5 text-sm font-semibold" style={{ background: "oklch(0.7 0.15 200 / 0.9)", color: "var(--primary-foreground)" }}>
          {restaurant.tag}
        </span>
      )}

      <div className="h-20 w-full overflow-hidden" style={{ background: "var(--secondary)" }}>
        <img
          src={imageSrc}
          alt={restaurant.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            const currentAttempt = Number(e.currentTarget.dataset.fallbackAttempt || "0");
            if (currentAttempt >= DEFAULT_RESTAURANT_IMAGES.length - 1) return;
            const nextAttempt = currentAttempt + 1;
            e.currentTarget.dataset.fallbackAttempt = String(nextAttempt);
            e.currentTarget.src =
              DEFAULT_RESTAURANT_IMAGES[(fallbackStart + nextAttempt) % DEFAULT_RESTAURANT_IMAGES.length];
          }}
        />
      </div>

      <button
        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full"
        style={{ background: "oklch(0 0 0 / 0.4)", backdropFilter: "blur(4px)" }}
        aria-label="Save"
      >
        <Heart className="h-3.5 w-3.5" style={{ color: "var(--foreground)" }} />
      </button>

      <div className="p-3.5">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="truncate text-sm font-semibold" style={{ color: "var(--foreground)" }}>{restaurant.name}</h4>
              {restaurant.veg && <Leaf className="h-3 w-3 shrink-0" style={{ color: "var(--accent)" }} />}
            </div>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{restaurant.cuisine}</p>
          </div>
          <div className="flex items-center gap-1 rounded-md px-1.5 py-0.5" style={{ background: "oklch(0.7 0.15 200 / 0.1)" }}>
            <Star className="h-3 w-3 fill-[var(--primary)] text-[var(--primary)]" />
            <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>{restaurant.rating}</span>
          </div>
        </div>

        <p className="mb-2 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{restaurant.highlight}</p>

        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {restaurant.features.map((f) => (
            <span key={f} className="rounded-md px-1.5 py-0.5 text-sm" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>{f}</span>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm" style={{ color: "var(--muted-foreground)" }}>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{restaurant.location.split(",")[0]}</span>
            <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{restaurant.timing.split(" - ")[0]}</span>
          </div>
          <PriceIndicator range={restaurant.priceRange} />
        </div>

        <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--glass-border)" }}>
          <span className="flex items-center gap-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
            <BadgeCheck className="h-3 w-3" style={{ color: "var(--accent)" }} />
            {restaurant.reviews.toLocaleString()} reviews
          </span>
          <a
            href={redirectUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors hover:brightness-110"
            style={{ background: "oklch(0.7 0.15 200 / 0.1)", color: "var(--primary)" }}
          >
            <Flame className="mr-1 inline h-3 w-3" />Reserve
          </a>
        </div>
      </div>
    </div>
  );
}

interface DineColumnProps {
  loading?: boolean;
  restaurants?: RestaurantResult[];
}

export function DineColumn({ loading, restaurants }: DineColumnProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 pb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "oklch(0.65 0.18 30 / 0.1)" }}>
          <Utensils className="h-4 w-4" style={{ color: "var(--chart-3)" }} />
        </div>
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Dine-in</h3>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Restaurants & cuisine</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : (restaurants || []).map((r) => <RestaurantCard key={r.name} restaurant={r} />)
        }
      </div>
    </div>
  );
}
