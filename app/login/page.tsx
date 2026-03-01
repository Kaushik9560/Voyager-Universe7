"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { MapPin, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        setError(payload?.error || "Login failed.");
        return;
      }

      const next = searchParams.get("next");
      const redirectTarget = next && next.startsWith("/") ? next : "/planning";
      router.push(redirectTarget);
      router.refresh();
    } catch {
      setError("Unable to login right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="voyager-page-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute -top-40 left-0 h-[360px] w-[360px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.14 190 / 0.18), transparent 72%)" }}
        />
        <div
          className="absolute -bottom-24 right-0 h-[340px] w-[340px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.73 0.12 155 / 0.16), transparent 70%)" }}
        />
      </div>

      <div
        className="voyager-glass-card relative z-10 w-full max-w-md rounded-3xl p-8 shadow-xl"
        style={{
          boxShadow: "0 30px 60px oklch(0 0 0 / 0.2)",
        }}
      >
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--accent))",
                color: "var(--primary-foreground)",
              }}
            >
              <MapPin className="h-5 w-5" />
            </div>
            <span className="text-2xl font-black tracking-tight">Voyager</span>
          </Link>
          <span
            className="voyager-badge text-[11px]"
            style={{
              color: "var(--muted-foreground)",
            }}
          >
            <Sparkles className="h-3 w-3" style={{ color: "var(--primary)" }} />
            AI
          </span>
        </div>

        <h1 className="voyager-title-gradient text-3xl font-black tracking-tight">Login</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
          Access your planning dashboard.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold" style={{ color: "var(--muted-foreground)" }}>
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="voyager-input text-sm"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold" style={{ color: "var(--muted-foreground)" }}>
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="voyager-input text-sm"
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </label>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="voyager-btn-primary w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              color: "var(--primary-foreground)",
            }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-4 text-sm" style={{ color: "var(--muted-foreground)" }}>
          New here?{" "}
          <Link href="/signup" className="font-semibold underline-offset-2 hover:underline" style={{ color: "var(--foreground)" }}>
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
