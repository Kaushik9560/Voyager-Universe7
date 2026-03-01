"use client";

import { useEffect, useRef, useState } from "react";
import { Plane, Train, ArrowDown, Clock, Luggage, Zap, MapPin, Mic } from "lucide-react";


interface SpeechRecognitionResultLike {
  [index: number]: {
    transcript: string;
  };
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    [index: number]: SpeechRecognitionResultLike;
    length: number;
  };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

interface FlightResult {
  airline: string;
  flightCode: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: string;
  price: number;
  stops: string;
  tag?: string;
  redirectUrl?: string;
}

interface TrainResult {
  name: string;
  code: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: string;
  price: number;
  class: string;
  tag: string | null;
}

const CITY_TO_STATION: Record<string, string> = {
  Delhi: "NDLS",
  "New Delhi": "NDLS",
  Mumbai: "CSTM",
  Bangalore: "SBC",
  Bengaluru: "SBC",
  Chennai: "MAS",
  Kolkata: "HWH",
  Hyderabad: "SC",
  Pune: "PUNE",
  Jaipur: "JP",
  Goa: "MAO",
  Kochi: "ERS",
};

const TRAIN_ROUTE_BASE_HOURS: Record<string, number> = {
  "NDLS-MAO": 18.5,
  "NDLS-JP": 5.5,
  "NDLS-SBC": 33,
  "NDLS-CSTM": 16,
  "NDLS-SC": 21,
  "NDLS-MAS": 29,
  "NDLS-HWH": 17,
  "NDLS-ERS": 44,
  "NDLS-PUNE": 21,
  "CSTM-MAO": 11,
  "CSTM-SBC": 23,
  "SBC-MAS": 6,
  "SBC-ERS": 10,
  "MAS-HWH": 28,
};

function toStationCode(city?: string): string {
  if (!city) return "SRC";
  return CITY_TO_STATION[city] || city.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "SRC";
}

function trainRouteKey(a: string, b: string): string {
  return `${a}-${b}`;
}

function hashRoute(a: string, b: string): number {
  const s = `${a}-${b}`;
  let total = 0;
  for (let i = 0; i < s.length; i += 1) total += s.charCodeAt(i) * (i + 1);
  return total;
}

function getBaseTrainHours(fromCode: string, toCode: string): number {
  const direct = TRAIN_ROUTE_BASE_HOURS[trainRouteKey(fromCode, toCode)];
  if (direct) return direct;
  const reverse = TRAIN_ROUTE_BASE_HOURS[trainRouteKey(toCode, fromCode)];
  if (reverse) return reverse;
  return 6 + (hashRoute(fromCode, toCode) % 28);
}

function toDurationLabel(totalMinutes: number): string {
  const mins = Math.max(30, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function addClockTime(hhmm: string, minutesToAdd: number): string {
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw || 0);
  const m = Number(mRaw || 0);
  const totalStart = h * 60 + m;
  const total = totalStart + Math.max(0, Math.round(minutesToAdd));
  const dayOffset = Math.floor(total / (24 * 60));
  const inDay = total % (24 * 60);
  const outH = String(Math.floor(inDay / 60)).padStart(2, "0");
  const outM = String(inDay % 60).padStart(2, "0");
  return dayOffset > 0 ? `${outH}:${outM}+${dayOffset}` : `${outH}:${outM}`;
}

function getMockTrains(from?: string, to?: string): TrainResult[] {
  const fromCode = toStationCode(from);
  const toCode = toStationCode(to);
  const baseHours = getBaseTrainHours(fromCode, toCode);
  const mainMinutes = Math.round(baseHours * 60);
  const altMinutes = Math.round((baseHours + 2 + (hashRoute(fromCode, toCode) % 4)) * 60);
  const firstDeparture = "16:55";
  const secondDeparture = "15:00";

  return [
    {
      name: "Rajdhani Express",
      code: "12431",
      from: fromCode,
      to: toCode,
      departure: firstDeparture,
      arrival: addClockTime(firstDeparture, mainMinutes),
      duration: toDurationLabel(mainMinutes),
      price: 1850,
      class: "3AC",
      tag: "Value pick",
    },
    {
      name: "Intercity Express",
      code: "12779",
      from: fromCode,
      to: toCode,
      departure: secondDeparture,
      arrival: addClockTime(secondDeparture, altMinutes),
      duration: toDurationLabel(altMinutes),
      price: 995,
      class: "SL",
      tag: null,
    },
  ];
}


function findReverseFlights(
  flights: FlightResult[] | undefined,
  fromCity: string,
  toCity: string,
): FlightResult[] {
  if (!flights || flights.length === 0) return [];
  return flights.filter(
    (f) =>
      f.from.toLowerCase() === toCity.toLowerCase() &&
      f.to.toLowerCase() === fromCity.toLowerCase(),
  );
}

function formatJourneyDateLabel(value?: string): string {
  if (!value) return "Date flexible";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dt = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const MAX_FLIGHT_OPTIONS = 8;
const MAX_TRAIN_OPTIONS = 6;


function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border p-3.5" style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg" style={{ background: "var(--secondary)" }} />
          <div className="space-y-1">
            <div className="h-3 w-20 rounded" style={{ background: "var(--secondary)" }} />
            <div className="h-2 w-12 rounded" style={{ background: "var(--secondary)" }} />
          </div>
        </div>
        <div className="h-4 w-16 rounded" style={{ background: "var(--secondary)" }} />
      </div>
      <div className="h-8 rounded" style={{ background: "var(--secondary)" }} />
    </div>
  );
}

function FlightCard({ flight, index }: { flight: FlightResult; index: number }) {
  const redirectUrl =
    flight.redirectUrl ||
    `https://www.google.com/travel/flights?q=${encodeURIComponent(`${flight.from} to ${flight.to}`)}`;

  return (
    <div
      className="group relative cursor-pointer rounded-xl border p-3.5 transition-all hover:scale-[1.02] hover:-translate-y-0.5"
      style={{
        borderColor: "var(--glass-border)",
        background: "var(--glass)",
        backdropFilter: "blur(8px)",
        animationDelay: `${index * 0.08}s`,
      }}
    >
      {flight.tag && (
        <span
          className="absolute -top-2 right-3 rounded-full border-0 px-2 py-0.5 text-sm font-semibold"
          style={{ background: "oklch(0.7 0.15 200 / 0.2)", color: "var(--primary)" }}
        >
          {flight.tag}
        </span>
      )}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "oklch(0.7 0.15 200 / 0.1)" }}>
            <Plane className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{flight.airline}</p>
            <p className="font-mono text-sm" style={{ color: "var(--muted-foreground)" }}>{flight.flightCode}</p>
          </div>
        </div>
        <p className="font-mono text-sm font-bold" style={{ color: "var(--foreground)" }}>
          ₹{flight.price.toLocaleString()}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-center">
          <p className="font-mono text-sm font-semibold" style={{ color: "var(--foreground)" }}>{flight.departure}</p>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{flight.from}</p>
        </div>
        <div className="flex flex-1 flex-col items-center px-2">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{flight.duration}</p>
          <div className="relative my-1 h-px w-full" style={{ background: "var(--glass-border)" }}>
            <div className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "var(--primary)" }} />
          </div>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{flight.stops}</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-sm font-semibold" style={{ color: "var(--foreground)" }}>{flight.arrival}</p>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{flight.to}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
        <span className="flex items-center gap-1"><Luggage className="h-3 w-3" /> 15kg</span>
        <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Instant confirm</span>
      </div>
      <a
        href={redirectUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block w-full rounded-lg py-1.5 text-center text-sm font-semibold transition-colors hover:brightness-110"
        style={{ background: "oklch(0.7 0.15 200 / 0.1)", color: "var(--primary)" }}
      >
        View Flight
      </a>
    </div>
  );
}

function TrainCard({ train }: { train: TrainResult }) {
  return (
    <div
      className="group relative cursor-pointer rounded-xl border p-3.5 transition-all hover:scale-[1.02] hover:-translate-y-0.5"
      style={{ borderColor: "var(--glass-border)", background: "var(--glass)", backdropFilter: "blur(8px)" }}
    >
      {train.tag && (
        <span className="absolute -top-2 right-3 rounded-full px-2 py-0.5 text-sm font-semibold" style={{ background: "oklch(0.75 0.12 160 / 0.2)", color: "var(--accent)" }}>
          {train.tag}
        </span>
      )}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "oklch(0.75 0.12 160 / 0.1)" }}>
            <Train className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{train.name}</p>
            <p className="font-mono text-sm" style={{ color: "var(--muted-foreground)" }}>#{train.code}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-bold" style={{ color: "var(--foreground)" }}>₹{train.price.toLocaleString()}</p>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{train.class}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-center">
          <p className="font-mono text-sm font-semibold" style={{ color: "var(--foreground)" }}>{train.departure}</p>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{train.from}</p>
        </div>
        <div className="flex flex-1 flex-col items-center px-2">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{train.duration}</p>
          <div className="relative my-1 h-px w-full" style={{ background: "var(--glass-border)" }}>
            <div className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "var(--accent)" }} />
          </div>
          <span className="flex items-center gap-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
            <Clock className="h-2.5 w-2.5" /> Overnight
          </span>
        </div>
        <div className="text-center">
          <p className="font-mono text-sm font-semibold" style={{ color: "var(--foreground)" }}>{train.arrival}</p>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{train.to}</p>
        </div>
      </div>
    </div>
  );
}

interface CommuteColumnProps {
  loading?: boolean;
  flights?: FlightResult[];
  onwardFlights?: FlightResult[];
  returnFlights?: FlightResult[];
  from?: string;
  to?: string;
  onwardDate?: string;
  returnDate?: string;
  onApplyRoute?: (from: string, to: string) => void;
}

export function CommuteColumn({
  loading,
  flights,
  onwardFlights,
  returnFlights,
  from,
  to,
  onwardDate,
  returnDate,
  onApplyRoute,
}: CommuteColumnProps) {
  const [fromInput, setFromInput] = useState(from || "");
  const [toInput, setToInput] = useState(to || "");
  const lastAutoApplied = useRef("");

const [speechSupported, setSpeechSupported] = useState(true);
const [listeningField, setListeningField] = useState<"from" | "to" | null>(null);
const [micError, setMicError] = useState<string | null>(null);
const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
const activeFieldRef = useRef<"from" | "to" | null>(null);



  useEffect(() => {
    setFromInput(from || "");
  }, [from]);

  useEffect(() => {
    setToInput(to || "");
  }, [to]);

const fromTrimmed = fromInput.trim();
const toTrimmed = toInput.trim();

const baseFrom = fromTrimmed || from || "";
const baseTo = toTrimmed || to || "";

const onwardTrainsAll = baseFrom && baseTo ? getMockTrains(baseFrom, baseTo) : [];
const returnTrainsAll = baseFrom && baseTo ? getMockTrains(baseTo, baseFrom) : [];

const onwardFlightsAll =
  onwardFlights ||
  (flights && baseFrom && baseTo
    ? flights.filter(
        (f) =>
          f.from.toLowerCase() === baseFrom.toLowerCase() &&
          f.to.toLowerCase() === baseTo.toLowerCase(),
      )
    : flights || []);

const returnFlightsAll =
  returnFlights ||
  (baseFrom && baseTo ? findReverseFlights(flights, baseFrom, baseTo) : []);

const onwardTrains = onwardTrainsAll.slice(0, MAX_TRAIN_OPTIONS);
const returnTrains = returnTrainsAll.slice(0, MAX_TRAIN_OPTIONS);
const onwardFlightsList = onwardFlightsAll.slice(0, MAX_FLIGHT_OPTIONS);
const returnFlightsList = returnFlightsAll.slice(0, MAX_FLIGHT_OPTIONS);



useEffect(() => {
  if (typeof window === "undefined") return;

  const speechWindow = window as SpeechRecognitionWindow;
  const SpeechRecognitionCtor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

  if (!SpeechRecognitionCtor) {
    setSpeechSupported(false);
    return;
  }

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = Array.from(
      { length: event.results.length - event.resultIndex },
      (_, idx) => event.results[event.resultIndex + idx]?.[0]?.transcript ?? "",
    )
      .join(" ")
      .trim();

    if (!transcript) return;

    if (activeFieldRef.current === "from") setFromInput(transcript);
    if (activeFieldRef.current === "to") setToInput(transcript);
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed") setMicError("Microphone permission denied. Please allow mic access.");
    else if (event.error === "no-speech") setMicError("No speech detected. Please try again.");
    else setMicError("Voice input failed. Please try again.");
  };

  recognition.onend = () => {
    setListeningField(null);
    activeFieldRef.current = null;
  };

  recognitionRef.current = recognition;

  return () => {
    recognition.abort();
    recognitionRef.current = null;
  };
}, []);

const toggleMic = (field: "from" | "to") => {
  const recognition = recognitionRef.current;
  if (!recognition || !speechSupported) {
    setMicError("Voice input is not supported in this browser.");
    return;
  }

  try {
    setMicError(null);
    if (listeningField === field) {
      recognition.stop();
      setListeningField(null);
      activeFieldRef.current = null;
    } else {
      activeFieldRef.current = field;
      recognition.start();
      setListeningField(field);
    }
  } catch {
    setListeningField(null);
    activeFieldRef.current = null;
    setMicError("Unable to start microphone. Please retry.");
  }
};

  const canApply = Boolean(toTrimmed);
  const applyRoute = () => {
    if (!onApplyRoute || !canApply) return;
    lastAutoApplied.current = `${fromTrimmed}|${toTrimmed}`;
    onApplyRoute(fromTrimmed, toTrimmed);
  };

  useEffect(() => {
    if (!onApplyRoute || !canApply) return;
    const key = `${fromTrimmed}|${toTrimmed}`;
    if (key === lastAutoApplied.current) return;

    const timer = setTimeout(() => {
      lastAutoApplied.current = key;
      onApplyRoute(fromTrimmed, toTrimmed);
    }, 600);

    return () => clearTimeout(timer);
  }, [onApplyRoute, canApply, fromTrimmed, toTrimmed]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 pb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "oklch(0.7 0.15 200 / 0.12)" }}>
          <Plane className="h-4 w-4" style={{ color: "var(--primary)" }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Commute
          </p>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Flights + trains — onward & return
          </p>
        </div>
      </div>

      {/* Route input */}
      <div className="rounded-2xl border p-3" style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}>
        <p className="mb-2 text-sm font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
          Route
        </p>

        <div className="flex flex-col gap-2 rounded-xl border p-2" style={{ borderColor: "var(--glass-border)", background: "oklch(0.7 0.15 200 / 0.05)" }}>
          <div className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}>
            <label className="mb-1 block text-sm font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
              From
            </label>
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3" style={{ color: "var(--accent)" }} />
              <input
                type="text"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                placeholder="e.g. Delhi"
                className="w-full bg-transparent text-sm font-medium outline-none"
                style={{ color: "var(--foreground)" }}
              />
              <button
                type="button"
                onClick={() => toggleMic("from")}
                disabled={!speechSupported}
                className="flex h-6 w-6 items-center justify-center rounded-md border transition disabled:opacity-40"
                style={{ borderColor: "var(--glass-border)", background: "var(--glass)", color: listeningField === "from" ? "var(--primary)" : "var(--muted-foreground)" }}
                aria-label="Voice input for From"
                title={speechSupported ? "Use microphone" : "Voice input unsupported in this browser"}
              >
                <Mic className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border" style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}>
              <ArrowDown className="h-3 w-3" style={{ color: "var(--muted-foreground)" }} />
            </div>
          </div>

          <div className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}>
            <label className="mb-1 block text-sm font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
              To
            </label>
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3" style={{ color: "var(--accent)" }} />
              <input
                type="text"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                placeholder="e.g. Amritsar"
                className="w-full bg-transparent text-sm font-medium outline-none"
                style={{ color: "var(--foreground)" }}
              />
              <button
                type="button"
                onClick={() => toggleMic("to")}
                disabled={!speechSupported}
                className="flex h-6 w-6 items-center justify-center rounded-md border transition disabled:opacity-40"
                style={{ borderColor: "var(--glass-border)", background: "var(--glass)", color: listeningField === "to" ? "var(--primary)" : "var(--muted-foreground)" }}
                aria-label="Voice input for To"
                title={speechSupported ? "Use microphone" : "Voice input unsupported in this browser"}
              >
                <Mic className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {micError ? (
          <div className="mt-2 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--glass-border)", background: "oklch(0.6 0.18 30 / 0.08)", color: "var(--muted-foreground)" }}>
            {micError}
          </div>
        ) : null}

        <button
          type="button"
          onClick={applyRoute}
          disabled={!canApply}
          className="mt-2 w-full rounded-lg py-1.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "oklch(0.7 0.15 200 / 0.12)", color: "var(--primary)" }}
        >
          Update Route
        </button>
      </div>

      {/* Onward + Return split view */}
      <div className="grid grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] gap-4">
        {/* Onward */}
        <div className="rounded-2xl border p-3" style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--foreground)" }}>
              Onward journey
            </p>
            <span className="rounded-md px-2 py-0.5 text-sm font-medium" style={{ background: "oklch(0.7 0.15 200 / 0.08)", color: "var(--primary)" }}>
              {formatJourneyDateLabel(onwardDate)}
            </span>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
              Flights
            </p>
            <div className="flex flex-col gap-3">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={`onward-skel-${i}`} />)
              ) : onwardFlightsList.length > 0 ? (
                onwardFlightsList.map((f, i) => <FlightCard key={`onward-${f.flightCode}-${i}`} flight={f} index={i} />)
              ) : (
                <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--glass-border)", background: "var(--glass)", color: "var(--muted-foreground)" }}>
                  Onward flight options unavailable for selected start date.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
              Trains
            </p>
            <div className="flex flex-col gap-3">
              {onwardTrains.length > 0 ? (
                onwardTrains.map((t) => <TrainCard key={`onward-${t.code}-${t.from}-${t.to}`} train={t} />)
              ) : (
                <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--glass-border)", background: "var(--glass)", color: "var(--muted-foreground)" }}>
                  Add origin and destination to see onward rail options.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-px" style={{ background: "var(--glass-border)" }} />

        {/* Return */}
        <div className="rounded-2xl border p-3" style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--foreground)" }}>
              Return journey
            </p>
            <span className="rounded-md px-2 py-0.5 text-sm font-medium" style={{ background: "oklch(0.75 0.12 160 / 0.1)", color: "var(--accent)" }}>
              {formatJourneyDateLabel(returnDate)}
            </span>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
              Flights
            </p>
            <div className="flex flex-col gap-3">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={`return-skel-${i}`} />)
              ) : returnFlightsList.length > 0 ? (
                returnFlightsList.map((f, i) => <FlightCard key={`return-${f.flightCode}-${i}`} flight={f} index={i} />)
              ) : (
                <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--glass-border)", background: "var(--glass)", color: "var(--muted-foreground)" }}>
                  Return options are shown separately and only when return inventory is available.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
              Trains
            </p>
            <div className="flex flex-col gap-3">
              {returnTrains.length > 0 ? (
                returnTrains.map((t) => <TrainCard key={`return-${t.code}-${t.from}-${t.to}`} train={t} />)
              ) : (
                <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--glass-border)", background: "var(--glass)", color: "var(--muted-foreground)" }}>
                  Return rail options will appear here based on route and date.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
