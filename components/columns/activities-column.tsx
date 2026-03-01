"use client";

import { Camera, Clock, Star, Users, Compass, Zap, Heart } from "lucide-react";

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

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Culture: { bg: "oklch(0.7 0.12 300 / 0.1)", text: "oklch(0.7 0.12 300)" },
  Adventure: { bg: "oklch(0.65 0.18 30 / 0.1)", text: "oklch(0.65 0.18 30)" },
  Nature: { bg: "oklch(0.75 0.12 160 / 0.1)", text: "var(--accent)" },
  Food: { bg: "oklch(0.7 0.15 200 / 0.1)", text: "var(--primary)" },
  Default: { bg: "oklch(0.7 0.15 200 / 0.1)", text: "var(--primary)" },
};
const DEFAULT_ACTIVITY_IMAGES = [
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1524492514790-831f5b607f5d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80",
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
        <div className="h-3 w-3/4 rounded" style={{ background: "var(--secondary)" }} />
        <div className="h-2 w-full rounded" style={{ background: "var(--secondary)" }} />
        <div className="flex gap-2">
          <div className="h-8 flex-1 rounded" style={{ background: "var(--secondary)" }} />
          <div className="h-8 w-20 rounded" style={{ background: "var(--secondary)" }} />
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ activity }: { activity: ActivityResult }) {
  const colorClass = CATEGORY_COLORS[activity.category] || CATEGORY_COLORS.Default;
  const fallbackStart = hashSeed(`${activity.name}-${activity.category}`) % DEFAULT_ACTIVITY_IMAGES.length;
  const imageSrc = activity.imageUrl || DEFAULT_ACTIVITY_IMAGES[fallbackStart];
  const redirectUrl =
    activity.redirectUrl ||
    `https://www.google.com/search?q=${encodeURIComponent(`${activity.name} official website`)}`;

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-xl border transition-all hover:scale-[1.02] hover:-translate-y-0.5"
      style={{ borderColor: "var(--glass-border)", background: "var(--glass)", backdropFilter: "blur(8px)" }}
    >
      {activity.tag && (
        <span className="absolute top-2 left-2 z-10 rounded-full px-2 py-0.5 text-sm font-semibold" style={{ background: "oklch(0.7 0.15 200 / 0.9)", color: "var(--primary-foreground)" }}>
          {activity.tag}
        </span>
      )}

      <div className="h-20 w-full overflow-hidden" style={{ background: "var(--secondary)" }}>
        <img
          src={imageSrc}
          alt={activity.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            const currentAttempt = Number(e.currentTarget.dataset.fallbackAttempt || "0");
            if (currentAttempt >= DEFAULT_ACTIVITY_IMAGES.length - 1) return;
            const nextAttempt = currentAttempt + 1;
            e.currentTarget.dataset.fallbackAttempt = String(nextAttempt);
            e.currentTarget.src =
              DEFAULT_ACTIVITY_IMAGES[(fallbackStart + nextAttempt) % DEFAULT_ACTIVITY_IMAGES.length];
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
          <span className="rounded-md px-1.5 py-0.5 text-sm font-medium" style={{ background: colorClass.bg, color: colorClass.text }}>
            {activity.category}
          </span>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-[var(--chart-5)] text-[var(--chart-5)]" />
            <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{activity.rating}</span>
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>({activity.reviews})</span>
          </div>
        </div>

        <h4 className="mb-1 text-sm font-semibold" style={{ color: "var(--foreground)" }}>{activity.name}</h4>
        <p className="mb-2 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{activity.description}</p>

        <div className="mb-2.5 flex flex-wrap gap-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
          <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{activity.duration}</span>
          <span className="flex items-center gap-1"><Users className="h-2.5 w-2.5" />Up to 12</span>
          <span className="flex items-center gap-1"><Camera className="h-2.5 w-2.5" />Photo ops</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-sm font-bold" style={{ color: "var(--foreground)" }}>₹{activity.price.toLocaleString()}</p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>per person</p>
          </div>
          <a
            href={redirectUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors hover:brightness-110"
            style={{ background: "oklch(0.7 0.15 200 / 0.1)", color: "var(--primary)" }}
          >
            <Zap className="mr-1 inline h-3 w-3" />Book now
          </a>
        </div>
      </div>
    </div>
  );
}

interface ActivitiesColumnProps {
  loading?: boolean;
  activities?: ActivityResult[];
}

export function ActivitiesColumn({ loading, activities }: ActivitiesColumnProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 pb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "oklch(0.65 0.18 30 / 0.1)" }}>
          <Compass className="h-4 w-4" style={{ color: "var(--chart-3)" }} />
        </div>
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Activities</h3>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Sightseeing & experiences</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : (activities || []).map((a) => <ActivityCard key={a.name} activity={a} />)
        }
      </div>
    </div>
  );
}
