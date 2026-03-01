"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Baby,
  CloudRain,
  CloudSun,
  Flame,
  LineChart,
  Minus,
  Mountain,
  ShieldPlus,
  ShoppingBag,
  Sparkles,
  Star,
  SunMedium,
  ThermometerSun,
  TrainFront,
  UtensilsCrossed,
} from "lucide-react";
import type { TripInsightsPayload } from "@/lib/trip-insights";

interface TripInsightsPanelProps {
  loading: boolean;
  error: string | null;
  insights: TripInsightsPayload | null;
}

interface TrendMeta {
  label: string;
  textColor: string;
  badgeBg: string;
  badgeBorder: string;
  chartColor: string;
  priceColor: string;
  Icon: typeof ArrowUpRight;
}

interface CategoryCardProps {
  title: string;
  items: Array<{ title: string; area: string; estimatedCost: number | null }>;
  icon: ReactNode;
}

interface FoodGroupProps {
  title: string;
  items: TripInsightsPayload["foodGuide"]["vegOnly"];
  cheapestPrice: number;
}

function formatInr(value: number): string {
  return `Rs ${Math.max(0, Math.round(value)).toLocaleString("en-IN")}`;
}

function getTrendMeta(outlook: string): TrendMeta {
  const tone = outlook.toLowerCase();
  if (tone.includes("rise") || tone.includes("up") || tone.includes("high")) {
    return {
      label: "Rising",
      textColor: "oklch(0.66 0.18 40)",
      badgeBg: "oklch(0.84 0.08 68 / 0.32)",
      badgeBorder: "oklch(0.68 0.14 65 / 0.42)",
      chartColor: "oklch(0.65 0.17 38)",
      priceColor: "oklch(0.64 0.18 40)",
      Icon: ArrowUpRight,
    };
  }

  if (tone.includes("fall") || tone.includes("down") || tone.includes("drop")) {
    return {
      label: "Cooling",
      textColor: "oklch(0.65 0.14 190)",
      badgeBg: "oklch(0.84 0.06 205 / 0.32)",
      badgeBorder: "oklch(0.64 0.11 215 / 0.4)",
      chartColor: "oklch(0.62 0.16 220)",
      priceColor: "oklch(0.62 0.16 220)",
      Icon: ArrowDownRight,
    };
  }

  return {
    label: "Stable",
    textColor: "oklch(0.63 0.15 145)",
    badgeBg: "oklch(0.85 0.08 145 / 0.3)",
    badgeBorder: "oklch(0.62 0.12 145 / 0.38)",
    chartColor: "oklch(0.63 0.15 145)",
    priceColor: "oklch(0.63 0.15 145)",
    Icon: Minus,
  };
}

function getWeatherIcon(summary: string) {
  const tone = summary.toLowerCase();
  if (tone.includes("rain") || tone.includes("shower")) return CloudRain;
  if (tone.includes("sun") || tone.includes("clear")) return SunMedium;
  return CloudSun;
}

function Sparkline({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  if (!values.length) {
    return <div className="h-16 rounded-xl border border-dashed border-white/25 bg-white/15" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const width = 260;
  const height = 64;
  const step = width / Math.max(1, values.length - 1);

  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  const fillPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full">
      <defs>
        <linearGradient id={`spark-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.36" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polyline fill={`url(#spark-${color.replace(/[^a-z0-9]/gi, "")})`} points={fillPoints} />
      <polyline fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function InsightsShell({
  title,
  icon,
  children,
  delay = 0,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay }}
      whileHover={{ scale: 1.015, y: -2 }}
      className="group relative overflow-hidden rounded-2xl border p-5"
      style={{
        borderColor: "var(--glass-border)",
        background: "linear-gradient(170deg, color-mix(in oklch, var(--surface-strong) 86%, white 14%), var(--surface-soft))",
        backdropFilter: "blur(18px)",
        boxShadow: "0 18px 40px oklch(0 0 0 / 0.14)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(130deg, oklch(0.86 0.07 210 / 0.18), transparent 35%, oklch(0.82 0.09 295 / 0.16))",
        }}
      />
      <div className="relative">
        <div className="mb-4 flex items-center gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border"
            style={{
              borderColor: "var(--glass-border)",
              background: "linear-gradient(145deg, oklch(0.95 0.03 220 / 0.72), oklch(0.9 0.05 280 / 0.5))",
            }}
          >
            {icon}
          </span>
          <h4 className="text-lg font-bold leading-none" style={{ color: "var(--foreground)" }}>
            {title}
          </h4>
        </div>
        {children}
      </div>
    </motion.article>
  );
}

function CategoryCard({ title, items, icon }: CategoryCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -2 }}
      transition={{ duration: 0.22 }}
      className="group rounded-2xl border"
      style={{
        borderColor: "var(--glass-border)",
        background: "color-mix(in oklch, var(--surface-soft) 72%, white 28%)",
        boxShadow: "0 10px 24px oklch(0 0 0 / 0.08)",
      }}
    >
      <div className="border-b px-4 py-3" style={{ borderColor: "var(--glass-border)" }}>
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted-foreground)" }}>
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full"
            style={{
              background: "linear-gradient(135deg, oklch(0.7 0.13 205 / 0.25), oklch(0.72 0.14 285 / 0.24))",
              color: "var(--foreground)",
            }}
          >
            {icon}
          </span>
          {title}
        </div>
      </div>
      <ul className="space-y-2 px-4 py-3">
        {items.slice(0, 3).map((item, index) => (
          <li key={`${title}-${item.title}-${index}`} className="text-sm leading-6" style={{ color: "var(--foreground)" }}>
            <span className="font-semibold">{item.title}</span>
            <span style={{ color: "var(--muted-foreground)" }}> - {item.area}</span>
            {item.estimatedCost ? (
              <span className="ml-1" style={{ color: "var(--muted-foreground)" }}>
                ({formatInr(item.estimatedCost)})
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function FoodGroup({ title, items, cheapestPrice }: FoodGroupProps) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: "var(--glass-border)",
        background: "color-mix(in oklch, var(--surface-soft) 70%, white 30%)",
      }}
    >
      <h5 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--foreground)" }}>
        {title}
      </h5>
      <ul className="space-y-2">
        {items.slice(0, 5).map((item) => {
          const cheapest = item.priceEstimate === cheapestPrice;
          return (
            <motion.li
              key={item.name}
              whileHover={{ x: 3 }}
              className="rounded-xl border px-3 py-2"
              style={{
                borderColor: cheapest ? "oklch(0.64 0.15 145 / 0.45)" : "var(--glass-border)",
                background: cheapest ? "oklch(0.9 0.07 145 / 0.2)" : "var(--surface-strong)",
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  {item.name}
                </span>
                <span
                  className="rounded-full border px-2 py-0.5 text-xs font-semibold"
                  style={{
                    borderColor: cheapest ? "oklch(0.64 0.15 145 / 0.45)" : "var(--glass-border)",
                    color: cheapest ? "oklch(0.5 0.11 145)" : "var(--muted-foreground)",
                    background: cheapest ? "oklch(0.92 0.06 145 / 0.32)" : "var(--surface-soft)",
                  }}
                >
                  {formatInr(item.priceEstimate)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                <span>{item.cuisine}</span>
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5" style={{ borderColor: "var(--glass-border)" }}>
                  <Star className="h-3 w-3 fill-current" />
                  {item.rating.toFixed(1)}
                </span>
                {cheapest ? (
                  <span
                    className="rounded-full border px-2 py-0.5 font-semibold"
                    style={{
                      borderColor: "oklch(0.64 0.15 145 / 0.45)",
                      color: "oklch(0.5 0.11 145)",
                    }}
                  >
                    Best value
                  </span>
                ) : null}
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

export function TripInsightsPanel({ loading, error, insights }: TripInsightsPanelProps) {
  const cheapestVeg = insights?.foodGuide.vegOnly.reduce((min, item) => Math.min(min, item.priceEstimate), Number.POSITIVE_INFINITY) ?? 0;
  const cheapestMulti =
    insights?.foodGuide.multiCuisine.reduce((min, item) => Math.min(min, item.priceEstimate), Number.POSITIVE_INFINITY) ?? 0;
  const overallCheapest = Math.min(cheapestVeg, cheapestMulti);

  return (
    <section
      className="relative mt-6 overflow-hidden rounded-2xl border p-4 md:p-6"
      style={{
        borderColor: "var(--glass-border)",
        background:
          "linear-gradient(140deg, color-mix(in oklch, var(--surface-strong) 80%, oklch(0.93 0.03 215) 20%), color-mix(in oklch, var(--surface-strong) 82%, oklch(0.9 0.04 285) 18%))",
        backdropFilter: "blur(18px)",
        boxShadow: "0 20px 48px oklch(0 0 0 / 0.14)",
      }}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        style={{
          background:
            "linear-gradient(110deg, oklch(0.8 0.08 220 / 0.2), oklch(0.84 0.08 285 / 0.14), oklch(0.78 0.09 200 / 0.2))",
          backgroundSize: "200% 200%",
        }}
      />

      <div className="relative z-10">
        <div
          className="mb-6 rounded-2xl border px-4 py-4 md:px-5"
          style={{
            borderColor: "var(--glass-border)",
            background: "color-mix(in oklch, var(--glass) 80%, white 20%)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{
                  borderColor: "var(--glass-border)",
                  background: "var(--surface-soft)",
                  color: "var(--muted-foreground)",
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI Predictive Engine
              </span>
              <h3
                className="mt-3 text-2xl font-black tracking-tight sm:text-3xl"
                style={{
                  background: "linear-gradient(130deg, oklch(0.56 0.18 220), oklch(0.58 0.16 285))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                Predictive Travel Insights
              </h3>
              <motion.div
                className="mt-2 h-1 rounded-full"
                initial={{ width: 0 }}
                whileInView={{ width: 170 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ background: "linear-gradient(90deg, var(--chart-1), var(--chart-4))" }}
              />
              <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: "var(--muted-foreground)" }}>
                Fare trend, weather, place category mapping, medical preparedness, and food ranking.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                style={{
                  borderColor: "var(--glass-border)",
                  background: "var(--surface-soft)",
                  color: "var(--foreground)",
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI model synced
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                style={{
                  borderColor: "var(--glass-border)",
                  background: "var(--surface-soft)",
                  color: "var(--foreground)",
                }}
              >
                <ShieldPlus className="h-3.5 w-3.5" />
                Theme-aware
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0.45 }}
                animate={{ opacity: [0.45, 0.8, 0.45] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: index * 0.06 }}
                className="h-40 rounded-2xl border"
                style={{
                  borderColor: "var(--glass-border)",
                  background: "linear-gradient(120deg, var(--surface-soft), var(--surface-strong), var(--surface-soft))",
                  backgroundSize: "200% 100%",
                }}
              />
            ))}
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
        ) : null}

        {!loading && !error && insights ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <InsightsShell title="Flight + Train Price Trend" icon={<LineChart className="h-5 w-5" style={{ color: "var(--chart-1)" }} />} delay={0.02}>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  {
                    name: "Flights",
                    outlook: insights.priceForecast.flight.outlook,
                    current: formatInr(insights.priceForecast.flight.currentBestPrice),
                    range: `${formatInr(insights.priceForecast.flight.daily[0]?.price ?? 0)} - ${formatInr(
                      insights.priceForecast.flight.daily[6]?.price ?? 0
                    )}`,
                    values: insights.priceForecast.flight.daily.slice(0, 7).map((day) => day.price),
                    note: insights.priceForecast.flight.note,
                  },
                  {
                    name: "Trains",
                    outlook: insights.priceForecast.train.outlook,
                    current: `${formatInr(insights.priceForecast.train.estimatedRange.min)} - ${formatInr(
                      insights.priceForecast.train.estimatedRange.max
                    )}`,
                    range: `${formatInr(insights.priceForecast.train.daily[0]?.price ?? insights.priceForecast.train.estimatedRange.min)} - ${formatInr(
                      insights.priceForecast.train.daily[6]?.price ?? insights.priceForecast.train.estimatedRange.max
                    )}`,
                    values: insights.priceForecast.train.daily.slice(0, 7).map((day) => day.price),
                    note: insights.priceForecast.train.note,
                  },
                ].map((item) => {
                  const trend = getTrendMeta(item.outlook);
                  const TrendIcon = trend.Icon;
                  return (
                    <motion.div
                      key={item.name}
                      whileHover={{ scale: 1.03 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-2xl border p-4"
                      style={{
                        borderColor: "var(--glass-border)",
                        background: "color-mix(in oklch, var(--surface-soft) 72%, white 28%)",
                        boxShadow: "0 10px 26px oklch(0 0 0 / 0.1)",
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h5 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                          {item.name}
                        </h5>
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold"
                          style={{
                            borderColor: trend.badgeBorder,
                            color: trend.textColor,
                            background: trend.badgeBg,
                          }}
                        >
                          <TrendIcon className="h-3.5 w-3.5" />
                          {trend.label}
                        </span>
                      </div>
                      <p className="text-xl font-black" style={{ color: trend.priceColor }}>
                        {item.current}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        7-day window: {item.range}
                      </p>
                      <div className="mt-2">
                        <Sparkline values={item.values} color={trend.chartColor} />
                      </div>
                      <p className="mt-1 text-xs leading-5" style={{ color: "var(--muted-foreground)" }}>
                        {item.note}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </InsightsShell>

            <InsightsShell title="7-Day Weather Trend + First Aid" icon={<CloudSun className="h-5 w-5" style={{ color: "var(--chart-2)" }} />} delay={0.08}>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
                <div
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: "var(--glass-border)",
                    background: "color-mix(in oklch, var(--surface-soft) 68%, white 32%)",
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        {insights.weatherTrend.destination} - {insights.weatherTrend.climateTag}
                      </p>
                      <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
                        {insights.weatherTrend.summary}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2" style={{ borderColor: "var(--glass-border)" }}>
                      <ThermometerSun className="h-4 w-4" style={{ color: "var(--chart-3)" }} />
                      <span className="text-2xl font-black" style={{ color: "var(--foreground)" }}>
                        {insights.weatherTrend.days[0]?.minTemp ?? 0}-{insights.weatherTrend.days[0]?.maxTemp ?? 0} C
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {insights.weatherTrend.days.slice(0, 5).map((day, index) => {
                      const WeatherIcon = getWeatherIcon(day.summary);
                      return (
                        <motion.span
                          key={day.date}
                          initial={{ opacity: 0, y: 8 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.35, delay: index * 0.06 }}
                          whileHover={{ scale: 1.04 }}
                          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
                          style={{
                            borderColor: "var(--glass-border)",
                            background: "var(--surface-strong)",
                            color: "var(--foreground)",
                          }}
                        >
                          <WeatherIcon className="h-3.5 w-3.5" />
                          {day.date.slice(5)} - {day.minTemp}-{day.maxTemp} C
                        </motion.span>
                      );
                    })}
                  </div>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.14 }}
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: "var(--glass-border)",
                    background: "color-mix(in oklch, var(--surface-soft) 68%, white 32%)",
                  }}
                >
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    Essential first-aid (weather-based)
                  </p>
                  <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted-foreground)" }}>
                    {insights.medicalKit.mustCarry.slice(0, 7).join(", ")}
                  </p>
                </motion.div>
              </motion.div>
            </InsightsShell>

            <InsightsShell title="Place Category Map" icon={<Activity className="h-5 w-5" style={{ color: "var(--chart-3)" }} />} delay={0.12}>
              <div className="grid gap-3 md:grid-cols-2">
                <CategoryCard
                  title="Adventure / Trek"
                  icon={<Mountain className="h-4 w-4" />}
                  items={[...insights.placeCategories.adventure, ...insights.placeCategories.trek].slice(0, 3)}
                />
                <CategoryCard
                  title="Sunrise / Sunset"
                  icon={<SunMedium className="h-4 w-4" />}
                  items={insights.placeCategories.sunriseSunset}
                />
                <CategoryCard
                  title="Kid Friendly"
                  icon={<Baby className="h-4 w-4" />}
                  items={insights.placeCategories.kidFriendly}
                />
                <CategoryCard title="Shopping" icon={<ShoppingBag className="h-4 w-4" />} items={insights.placeCategories.shopping} />
              </div>
            </InsightsShell>

            <InsightsShell
              title="Food: Veg + Multi-cuisine by Price"
              icon={<UtensilsCrossed className="h-5 w-5" style={{ color: "var(--chart-5)" }} />}
              delay={0.16}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <FoodGroup title="Veg only" items={insights.foodGuide.vegOnly} cheapestPrice={overallCheapest} />
                <FoodGroup title="Multi-cuisine" items={insights.foodGuide.multiCuisine} cheapestPrice={overallCheapest} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
                <motion.span
                  animate={{ opacity: [0.55, 1, 0.55] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border"
                  style={{ borderColor: "var(--glass-border)", background: "var(--surface-soft)" }}
                >
                  <Flame className="h-3.5 w-3.5" />
                </motion.span>
                <TrainFront className="h-4 w-4" />
                {insights.foodGuide.note}
              </div>
            </InsightsShell>
          </div>
        ) : null}

      </div>
    </section>
  );
}
