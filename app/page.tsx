import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Brain,
  Compass,
  Flame,
  Link2,
  Map,
  MapPin,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

type WorkflowStep = {
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
};

type DestinationCard = {
  city: string;
  country: string;
  fare: string;
  badge: string;
  badgeIcon: LucideIcon;
  image: string;
};

type PreviewInsight = {
  title: string;
  description: string;
  tone: string;
  image: string;
};

const workflowSteps: WorkflowStep[] = [
  {
    title: "AI Intent Understanding",
    description:
      "Describe your trip naturally and Voyager extracts dates, budget, vibe and trip priorities in one shot.",
    icon: Brain,
    tone: "var(--chart-1)",
  },
  {
    title: "Unified Search",
    description:
      "One search runs flights, hotels, activities and dining together so itinerary decisions stay in sync.",
    icon: Zap,
    tone: "var(--chart-3)",
  },
  {
    title: "Smart Personalization",
    description:
      "Results are ranked for your profile and constraints instead of generic popularity metrics.",
    icon: Compass,
    tone: "var(--chart-2)",
  },
  {
    title: "Visual Route Discovery",
    description:
      "Explore nearby options and commuting flow quickly with map-aware groupings for each destination.",
    icon: Map,
    tone: "var(--chart-4)",
  },
  {
    title: "Price Intelligence",
    description:
      "Voyager surfaces value picks and trade-offs so you can book at the right quality and budget point.",
    icon: TrendingUp,
    tone: "var(--chart-5)",
  },
  {
    title: "Context Bundling",
    description:
      "Flights, stays and local experiences are bundled around arrival context to cut planning friction.",
    icon: Link2,
    tone: "var(--primary)",
  },
];

const destinations: DestinationCard[] = [
  {
    city: "New Delhi",
    country: "India",
    fare: "From Rs 6,800 return",
    badge: "POPULAR",
    badgeIcon: Flame,
    image:
      "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1400&q=80",
  },
  {
    city: "Mumbai",
    country: "India",
    fare: "From Rs 7,500 return",
    badge: "POPULAR",
    badgeIcon: Sparkles,
    image:
      "https://images.unsplash.com/photo-1566552881560-0be862a7c445?auto=format&fit=crop&w=1400&q=80",
  },
  {
    city: "Jaipur",
    country: "India",
    fare: "From Rs 8,200 return",
    badge: "RISING",
    badgeIcon: TrendingUp,
    image:
      "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1400&q=80",
  },
  {
    city: "Bengaluru",
    country: "India",
    fare: "From Rs 7,900 return",
    badge: "RISING",
    badgeIcon: TrendingUp,
    image:
      "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1400&q=80",
  },
];

const previewInsights: PreviewInsight[] = [
  {
    title: "Flight Insight",
    description: "Best value window: 2 days earlier saves around 12%.",
    tone: "var(--chart-1)",
    image:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Stay Cluster",
    description: "4-star hotels near Seminyak with breakfast and airport transfer.",
    tone: "var(--chart-5)",
    image:
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Dining + Activities",
    description: "Family-friendly dining and cultural + beach activity mix selected.",
    tone: "var(--chart-2)",
    image:
      "https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?auto=format&fit=crop&w=1200&q=80",
  },
];

export default function HomePage() {
  return (
    <div className="voyager-page-shell relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute -top-44 -left-40 h-[480px] w-[480px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.14 190 / 0.18), transparent 72%)" }}
        />
        <div
          className="absolute right-[-120px] top-24 h-[420px] w-[420px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.75 0.12 155 / 0.16), transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-100px] left-1/2 h-[380px] w-[380px] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.14 40 / 0.12), transparent 68%)" }}
        />
      </div>

      <header
        className="sticky top-0 z-30 border-b"
        style={{
          borderColor: "var(--glass-border)",
          background: "var(--glass)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--accent))",
                color: "var(--primary-foreground)",
                boxShadow: "0 8px 24px oklch(0.7 0.14 190 / 0.25)",
              }}
            >
              <MapPin className="h-5 w-5" />
            </div>
            <span className="text-2xl font-black tracking-tight">Voyager</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login?next=/planning"
              className="voyager-btn-secondary rounded-xl px-4 py-2 text-sm font-semibold"
              style={{
                color: "var(--foreground)",
              }}
            >
              Login
            </Link>
            <Link
              href="/signup?next=/planning"
              className="voyager-btn-primary rounded-xl px-4 py-2 text-sm font-semibold"
              style={{
                color: "var(--primary-foreground)",
              }}
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid w-full max-w-7xl gap-8 px-5 pb-14 pt-14 sm:px-8 lg:grid-cols-2 lg:pt-20">
          <div>
            <p
              className="inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass)",
                color: "var(--muted-foreground)",
              }}
            >
              AI-powered Trip Planning
            </p>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              Build a complete trip,
              <span
                className="block"
                style={{
                  background: "linear-gradient(135deg, var(--primary), var(--accent))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                not just a booking.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8" style={{ color: "var(--muted-foreground)" }}>
              Voyager understands natural prompts, applies smart filters, and returns a
              synchronized travel plan with flights, stay, activities and dining in one flow.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/planning"
                className="voyager-btn-primary inline-flex items-center gap-2 rounded-2xl px-7 py-3 text-base font-semibold"
                style={{
                  color: "var(--primary-foreground)",
                }}
              >
                Start Planning
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#workflow"
                className="voyager-btn-secondary inline-flex items-center rounded-2xl px-7 py-3 text-base font-semibold"
                style={{
                  color: "var(--foreground)",
                }}
              >
                See workflow
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs">
              {["Prompt-aware filters", "Live fare + hotel sync", "One-click compare view"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border px-3 py-1.5"
                  style={{
                    borderColor: "var(--glass-border)",
                    background: "var(--glass-highlight)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div
            className="voyager-glass-card rounded-3xl p-5"
            style={{
              boxShadow: "0 20px 50px oklch(0 0 0 / 0.18)",
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted-foreground)" }}>
              Preview
            </p>
            <h2 className="mt-2 text-2xl font-bold">Delhi to Bali, 6 days, family trip</h2>
            <div className="mt-5 space-y-3">
              {previewInsights.map((insight) => (
                <div
                  key={insight.title}
                  className="grid grid-cols-[110px_1fr] gap-4 overflow-hidden rounded-2xl border p-3 sm:grid-cols-[140px_1fr]"
                  style={{ borderColor: "var(--glass-border)", background: "var(--card)" }}
                >
                  <div
                    className="h-24 rounded-xl bg-cover bg-center sm:h-full sm:min-h-[96px]"
                    style={{ backgroundImage: `linear-gradient(140deg, oklch(0 0 0 / 0.08), oklch(0 0 0 / 0.2)), url(${insight.image})` }}
                    role="img"
                    aria-label={`${insight.title} visual`}
                  />
                  <div className="py-1">
                    <p className="text-xs uppercase tracking-widest" style={{ color: insight.tone }}>
                      {insight.title}
                    </p>
                    <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
                      {insight.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>
                How Voyager Works
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">End-to-end planning system</h2>
            </div>
            <Link
              href="/planning"
              className="voyager-btn-secondary hidden rounded-full px-6 py-3 text-sm font-semibold md:inline-flex"
              style={{
                color: "var(--foreground)",
              }}
            >
              Try now
            </Link>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {workflowSteps.map((step) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.title}
                  className="voyager-glass-card voyager-hover-lift rounded-3xl p-7"
                  style={{
                    boxShadow: "0 16px 30px oklch(0 0 0 / 0.08)",
                  }}
                >
                  <div
                    className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ background: `${step.tone}26`, color: step.tone }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-2xl font-extrabold tracking-tight">{step.title}</h3>
                  <p className="mt-3 text-base leading-7" style={{ color: "var(--muted-foreground)" }}>
                    {step.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>
                Trending Destinations
              </p>
              <h2 className="mt-2 max-w-xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                Popular destinations to kickstart your planning
              </h2>
            </div>
            <Link
              href="/planning"
              className="voyager-btn-secondary inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold"
              style={{
                color: "var(--foreground)",
              }}
            >
              Explore all
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {destinations.map((item) => {
              const BadgeIcon = item.badgeIcon;
              return (
                <article
                  key={item.city}
                  className="group voyager-hover-lift relative overflow-hidden rounded-3xl border"
                  style={{
                    borderColor: "var(--glass-border)",
                    boxShadow: "0 18px 40px oklch(0 0 0 / 0.18)",
                  }}
                >
                  <div
                    className="absolute inset-0 scale-100 transition duration-500 group-hover:scale-105"
                    style={{
                      backgroundImage: `url(${item.image})`,
                      backgroundPosition: "center",
                      backgroundSize: "cover",
                    }}
                  />
                  <div
                    className="relative flex min-h-[280px] flex-col justify-between p-5 text-white"
                    style={{
                      background:
                        "linear-gradient(180deg, oklch(0.14 0.02 250 / 0.25) 8%, oklch(0.12 0.02 250 / 0.88) 100%)",
                    }}
                  >
                    <div className="flex justify-end">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold tracking-[0.14em] text-slate-900">
                        <BadgeIcon className="h-3.5 w-3.5" />
                        {item.badge}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-4xl font-black tracking-tight">{item.city}</h3>
                      <p className="mt-1 text-sm text-white/85">{item.country}</p>
                      <p className="mt-3 text-xl font-extrabold text-amber-300">{item.fare}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

