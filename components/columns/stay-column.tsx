"use client";

import { Star, Coffee, Wifi, Waves, MapPin, Building2, Heart } from "lucide-react";

interface HotelResult {
  resultIndex?: number;
  hotelCode?: string;
  hotelName: string;
  hotelImage?: string;
  hotelDescription?: string;
  address?: string;
  rating?: string;
  tripAdvisorRating?: string;
  price: number;
  currency?: string;
  originalPrice?: number;
  redirectUrl?: string;
}

const STAR_MAP: Record<string, number> = {
  OneStar: 1, TwoStar: 2, ThreeStar: 3, FourStar: 4, FiveStar: 5,
};
const DEFAULT_HOTEL_IMAGES = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1561501900-3701fa6a0864?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1576675784201-0e142b423952?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1444201983204-c43cbd584d93?auto=format&fit=crop&w=1200&q=80",
];

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border" style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}>
      <div className="h-24 w-full" style={{ background: "var(--secondary)" }} />
      <div className="p-3.5 space-y-2">
        <div className="h-3 w-3/4 rounded" style={{ background: "var(--secondary)" }} />
        <div className="h-2 w-1/2 rounded" style={{ background: "var(--secondary)" }} />
        <div className="h-8 rounded" style={{ background: "var(--secondary)" }} />
      </div>
    </div>
  );
}

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3 w-3 ${i < count ? "fill-[var(--chart-5)] text-[var(--chart-5)]" : "text-[var(--muted-foreground)/30]"}`} />
      ))}
    </div>
  );
}

function HotelCard({ hotel, index }: { hotel: HotelResult; index: number }) {
  const stars = STAR_MAP[hotel.rating || ""] || 3;
  const fallbackStart = index % DEFAULT_HOTEL_IMAGES.length;
  const imageSrc = DEFAULT_HOTEL_IMAGES[fallbackStart];
  const taRating = parseFloat(hotel.tripAdvisorRating || "0");
  const discount = hotel.originalPrice && hotel.originalPrice > hotel.price
    ? Math.round(((hotel.originalPrice - hotel.price) / hotel.originalPrice) * 100)
    : 0;
  const redirectUrl =
    hotel.redirectUrl ||
    `https://www.google.com/travel/hotels?q=${encodeURIComponent(`${hotel.hotelName} ${hotel.address || ""}`.trim())}`;

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-xl border transition-all hover:scale-[1.02] hover:-translate-y-0.5"
      style={{ borderColor: "var(--glass-border)", background: "var(--glass)", backdropFilter: "blur(8px)" }}
    >
      {/* Hotel image */}
      <div className="h-24 w-full overflow-hidden" style={{ background: "var(--secondary)" }}>
        <img
          src={imageSrc}
          alt={hotel.hotelName}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            const currentAttempt = Number(e.currentTarget.dataset.fallbackAttempt || "0");
            if (currentAttempt >= DEFAULT_HOTEL_IMAGES.length - 1) return;
            const nextAttempt = currentAttempt + 1;
            e.currentTarget.dataset.fallbackAttempt = String(nextAttempt);
            e.currentTarget.src =
              DEFAULT_HOTEL_IMAGES[(fallbackStart + nextAttempt) % DEFAULT_HOTEL_IMAGES.length];
          }}
        />
      </div>

      {/* Wishlist button */}
      <button
        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full transition-colors"
        style={{ background: "oklch(0 0 0 / 0.4)", backdropFilter: "blur(4px)" }}
        aria-label="Save to wishlist"
      >
        <Heart className="h-3.5 w-3.5" style={{ color: "var(--foreground)" }} />
      </button>

      <div className="p-3.5">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" style={{ color: "var(--foreground)" }}>{hotel.hotelName}</p>
            {hotel.address && (
              <p className="flex items-center gap-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                {hotel.address}
              </p>
            )}
          </div>
          {taRating > 0 && (
            <div className="flex items-center gap-1 rounded-md px-1.5 py-0.5" style={{ background: "oklch(0.7 0.15 200 / 0.1)" }}>
              <Star className="h-3 w-3 fill-[var(--primary)] text-[var(--primary)]" />
              <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>{taRating}</span>
            </div>
          )}
        </div>

        <div className="mb-2">
          <StarRating count={stars} />
          {hotel.hotelDescription && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              {hotel.hotelDescription}
            </p>
          )}
        </div>

        {/* Amenities (shown based on star rating as proxy) */}
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {stars >= 4 && (
            <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm" style={{ background: "oklch(0.75 0.12 160 / 0.1)", color: "var(--accent)" }}>
              <Coffee className="h-2.5 w-2.5" /> Breakfast
            </span>
          )}
          <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
            <Wifi className="h-2.5 w-2.5" /> Wi-Fi
          </span>
          {stars >= 5 && (
            <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
              <Waves className="h-2.5 w-2.5" /> Pool
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-end justify-between">
          <div>
            {hotel.originalPrice && hotel.originalPrice > hotel.price && (
              <>
                <span className="mr-1.5 text-sm line-through" style={{ color: "var(--muted-foreground)" }}>
                  ₹{hotel.originalPrice.toLocaleString()}
                </span>
                {discount > 0 && (
                  <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>{discount}% off</span>
                )}
              </>
            )}
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-bold" style={{ color: "var(--foreground)" }}>
              ₹{hotel.price.toLocaleString()}
            </p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>per night</p>
          </div>
        </div>

        <a
          href={redirectUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block w-full rounded-lg py-1.5 text-center text-sm font-semibold transition-colors hover:brightness-110"
          style={{ background: "oklch(0.7 0.15 200 / 0.1)", color: "var(--primary)" }}
        >
          View Rooms
        </a>
      </div>
    </div>
  );
}

interface StayColumnProps {
  loading?: boolean;
  hotels?: HotelResult[];
}

export function StayColumn({ loading, hotels }: StayColumnProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 pb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "oklch(0.8 0.15 80 / 0.1)" }}>
          <Building2 className="h-4 w-4" style={{ color: "var(--chart-5)" }} />
        </div>
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Stay</h3>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Hotels & resorts</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : (hotels || []).map((h, i) => <HotelCard key={h.hotelCode || i} hotel={h} index={i} />)
        }
      </div>
    </div>
  );
}
