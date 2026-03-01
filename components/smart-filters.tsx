// "use client";

// import { useState } from "react";
// import {
//   Plane,
//   Accessibility,
//   Coffee,
//   Wifi,
//   Baby,
//   Dog,
//   Heart,
//   Users,
//   Briefcase,
//   Sparkles,
//   ChevronDown,
//   SlidersHorizontal,
//   IndianRupee,
//   Clock,
//   MapPin,
//   Utensils,
//   Dumbbell,
//   Waves,
//   X,
// } from "lucide-react";

// interface FilterSectionProps {
//   title: string;
//   icon: React.ReactNode;
//   defaultOpen?: boolean;
//   children: React.ReactNode;
// }

// function FilterSection({ title, icon, defaultOpen = false, children }: FilterSectionProps) {
//   const [open, setOpen] = useState(defaultOpen);
//   return (
//     <div className="border-b pb-3" style={{ borderColor: "var(--glass-border)" }}>
//       <button
//         onClick={() => setOpen(!open)}
//         className="flex w-full items-center justify-between py-2 text-sm font-medium transition-colors"
//         style={{ color: "var(--foreground)" }}
//       >
//         <span className="flex items-center gap-2">{icon}{title}</span>
//         <ChevronDown
//           className="h-4 w-4 transition-transform duration-200"
//           style={{
//             color: "var(--muted-foreground)",
//             transform: open ? "rotate(180deg)" : "rotate(0deg)",
//           }}
//         />
//       </button>
//       {open && <div className="overflow-hidden pt-2 pb-1">{children}</div>}
//     </div>
//   );
// }

// interface CheckFilterProps {
//   label: string;
//   icon?: React.ReactNode;
//   checked: boolean;
//   onChange: (checked: boolean) => void;
// }

// function CheckFilter({ label, icon, checked, onChange }: CheckFilterProps) {
//   return (
//     <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors" style={{ color: "var(--muted-foreground)" }}>
//       <input
//         type="checkbox"
//         checked={checked}
//         onChange={(e) => onChange(e.target.checked)}
//         className="h-3.5 w-3.5 rounded accent-[oklch(0.7_0.15_200)]"
//       />
//       {icon && <span style={{ color: "var(--muted-foreground)" }}>{icon}</span>}
//       <span>{label}</span>
//     </label>
//   );
// }

// interface PillOption {
//   label: string;
//   active: boolean;
// }

// function PillGroup({ options, onToggle }: { options: PillOption[]; onToggle: (i: number) => void }) {
//   return (
//     <div className="flex flex-wrap gap-1.5">
//       {options.map((opt, i) => (
//         <button
//           key={opt.label}
//           onClick={() => onToggle(i)}
//           className="rounded-full border px-3 py-1 text-xs font-medium transition-all"
//           style={
//             opt.active
//               ? { borderColor: "oklch(0.7 0.15 200 / 0.5)", background: "oklch(0.7 0.15 200 / 0.15)", color: "var(--primary)" }
//               : { borderColor: "var(--glass-border)", background: "var(--glass)", color: "var(--muted-foreground)" }
//           }
//         >
//           {opt.label}
//         </button>
//       ))}
//     </div>
//   );
// }

// interface SmartFiltersProps {
//   open?: boolean;
//   onClose?: () => void;
// }

// export function SmartFilters({ open: mobileOpen = true, onClose }: SmartFiltersProps) {
//   const [budget, setBudget] = useState([5000, 60000]);
//   const [duration, setDuration] = useState([3, 7]);

//   const [travellerType, setTravellerType] = useState([
//     { label: "Solo", active: false },
//     { label: "Couple", active: true },
//     { label: "Family", active: false },
//     { label: "Friends", active: false },
//     { label: "Business", active: false },
//   ]);

//   const [vibes, setVibes] = useState([
//     { label: "Beach", active: true },
//     { label: "Hills", active: false },
//     { label: "Desert", active: false },
//     { label: "City", active: true },
//     { label: "Forest", active: false },
//     { label: "Snow", active: false },
//   ]);

//   const [stayFilters, setStayFilters] = useState({
//     highlyRated: true,
//     refundable: false,
//     breakfastIncluded: true,
//     freeWifi: false,
//     pool: false,
//     gym: false,
//   });

//   const [diningFilters, setDiningFilters] = useState({
//     vegOnly: false,
//     streetFood: true,
//     fineDining: false,
//     rooftop: false,
//   });

//   const [specialReqs, setSpecialReqs] = useState({
//     wheelchair: false,
//     petFriendly: false,
//     childFriendly: false,
//     honeymoon: false,
//     seniorFriendly: false,
//   });

//   const toggle = (arr: PillOption[], setter: React.Dispatch<React.SetStateAction<PillOption[]>>, i: number) => {
//     const updated = [...arr];
//     updated[i] = { ...updated[i], active: !updated[i].active };
//     setter(updated);
//   };

//   const fmt = (v: number) => {
//     if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
//     if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
//     return String(v);
//   };

//   return (
//     <>
//       {/* Overlay for mobile */}
//       {mobileOpen && onClose && (
//         <div
//           className="fixed inset-0 z-30 bg-black/50 lg:hidden"
//           onClick={onClose}
//         />
//       )}

//       <aside
//         className="fixed top-0 right-0 z-40 flex h-screen w-80 flex-col border-l"
//         style={{
//           borderColor: "var(--glass-border)",
//           background: "oklch(0.12 0.01 260 / 0.95)",
//           backdropFilter: "blur(24px)",
//           transform: `translateX(${mobileOpen ? "0" : "100%"})`,
//           transition: "transform 0.3s ease",
//         }}
//       >
//         {/* Header */}
//         <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--glass-border)" }}>
//           <div className="flex items-center gap-2">
//             <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "oklch(0.7 0.15 200 / 0.15)" }}>
//               <SlidersHorizontal className="h-4 w-4" style={{ color: "var(--primary)" }} />
//             </div>
//             <div>
//               <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Smart Filters</h2>
//               <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Refine your search</p>
//             </div>
//           </div>
//           {onClose && (
//             <button onClick={onClose} className="lg:hidden" style={{ color: "var(--muted-foreground)" }}>
//               <X className="h-4 w-4" />
//             </button>
//           )}
//         </div>

//         {/* Scrollable body */}
//         <div className="flex-1 overflow-y-auto px-5 py-3">
//           {/* Budget & Duration */}
//           <FilterSection title="Budget & Duration" icon={<IndianRupee className="h-4 w-4" style={{ color: "var(--primary)" }} />} defaultOpen>
//             <div className="space-y-4">
//               <div>
//                 <div className="mb-2 flex items-center justify-between text-xs" style={{ color: "var(--muted-foreground)" }}>
//                   <span>Budget (per person)</span>
//                   <span className="font-mono" style={{ color: "var(--foreground)" }}>{fmt(budget[0])} – {fmt(budget[1])}</span>
//                 </div>
//                 <input type="range" min={5000} max={100000} step={1000} value={budget[1]}
//                   onChange={(e) => setBudget([budget[0], Number(e.target.value)])}
//                   className="w-full accent-[oklch(0.7_0.15_200)]"
//                 />
//               </div>
//               <div>
//                 <div className="mb-2 flex items-center justify-between text-xs" style={{ color: "var(--muted-foreground)" }}>
//                   <span>Trip Duration</span>
//                   <span className="font-mono" style={{ color: "var(--foreground)" }}>{duration[0]} – {duration[1]} days</span>
//                 </div>
//                 <input type="range" min={1} max={21} step={1} value={duration[1]}
//                   onChange={(e) => setDuration([duration[0], Number(e.target.value)])}
//                   className="w-full accent-[oklch(0.7_0.15_200)]"
//                 />
//               </div>
//             </div>
//           </FilterSection>

//           {/* Who's Travelling */}
//           <FilterSection title="Who's Travelling?" icon={<Users className="h-4 w-4" style={{ color: "var(--primary)" }} />} defaultOpen>
//             <PillGroup options={travellerType} onToggle={(i) => toggle(travellerType, setTravellerType, i)} />
//           </FilterSection>

//           {/* Destination Vibe */}
//           <FilterSection title="Destination Vibe" icon={<MapPin className="h-4 w-4" style={{ color: "var(--primary)" }} />} defaultOpen>
//             <PillGroup options={vibes} onToggle={(i) => toggle(vibes, setVibes, i)} />
//           </FilterSection>

//           {/* Transport */}
//           <FilterSection title="Transport" icon={<Plane className="h-4 w-4" style={{ color: "var(--primary)" }} />}>
//             <div className="space-y-0.5">
//               <CheckFilter label="Direct flights only" icon={<Plane className="h-3.5 w-3.5" />} checked={false} onChange={() => {}} />
//               <CheckFilter label="Early morning" icon={<Clock className="h-3.5 w-3.5" />} checked={false} onChange={() => {}} />
//               <CheckFilter label="Flexible ±2 days" icon={<Sparkles className="h-3.5 w-3.5" />} checked={false} onChange={() => {}} />
//             </div>
//           </FilterSection>

//           {/* Stay */}
//           <FilterSection title="Stay Preferences" icon={<Coffee className="h-4 w-4" style={{ color: "var(--primary)" }} />}>
//             <div className="space-y-0.5">
//               <CheckFilter label="Highly rated (4.5+)" checked={stayFilters.highlyRated} onChange={(v) => setStayFilters((p) => ({ ...p, highlyRated: v }))} />
//               <CheckFilter label="Free cancellation" checked={stayFilters.refundable} onChange={(v) => setStayFilters((p) => ({ ...p, refundable: v }))} />
//               <CheckFilter label="Breakfast included" icon={<Coffee className="h-3.5 w-3.5" />} checked={stayFilters.breakfastIncluded} onChange={(v) => setStayFilters((p) => ({ ...p, breakfastIncluded: v }))} />
//               <CheckFilter label="Free Wi-Fi" icon={<Wifi className="h-3.5 w-3.5" />} checked={stayFilters.freeWifi} onChange={(v) => setStayFilters((p) => ({ ...p, freeWifi: v }))} />
//               <CheckFilter label="Pool / Spa" icon={<Waves className="h-3.5 w-3.5" />} checked={stayFilters.pool} onChange={(v) => setStayFilters((p) => ({ ...p, pool: v }))} />
//               <CheckFilter label="Gym / Fitness" icon={<Dumbbell className="h-3.5 w-3.5" />} checked={stayFilters.gym} onChange={(v) => setStayFilters((p) => ({ ...p, gym: v }))} />
//             </div>
//           </FilterSection>

//           {/* Dining */}
//           <FilterSection title="Food & Dining" icon={<Utensils className="h-4 w-4" style={{ color: "var(--primary)" }} />}>
//             <div className="space-y-0.5">
//               <CheckFilter label="Vegetarian only" checked={diningFilters.vegOnly} onChange={(v) => setDiningFilters((p) => ({ ...p, vegOnly: v }))} />
//               <CheckFilter label="Street food spots" checked={diningFilters.streetFood} onChange={(v) => setDiningFilters((p) => ({ ...p, streetFood: v }))} />
//               <CheckFilter label="Fine dining" checked={diningFilters.fineDining} onChange={(v) => setDiningFilters((p) => ({ ...p, fineDining: v }))} />
//               <CheckFilter label="Rooftop dining" checked={diningFilters.rooftop} onChange={(v) => setDiningFilters((p) => ({ ...p, rooftop: v }))} />
//             </div>
//           </FilterSection>

//           {/* Special */}
//           <FilterSection title="Special Requirements" icon={<Accessibility className="h-4 w-4" style={{ color: "var(--primary)" }} />}>
//             <div className="space-y-0.5">
//               <CheckFilter label="Wheelchair accessible" icon={<Accessibility className="h-3.5 w-3.5" />} checked={specialReqs.wheelchair} onChange={(v) => setSpecialReqs((p) => ({ ...p, wheelchair: v }))} />
//               <CheckFilter label="Pet-friendly" icon={<Dog className="h-3.5 w-3.5" />} checked={specialReqs.petFriendly} onChange={(v) => setSpecialReqs((p) => ({ ...p, petFriendly: v }))} />
//               <CheckFilter label="Child-friendly" icon={<Baby className="h-3.5 w-3.5" />} checked={specialReqs.childFriendly} onChange={(v) => setSpecialReqs((p) => ({ ...p, childFriendly: v }))} />
//               <CheckFilter label="Honeymoon" icon={<Heart className="h-3.5 w-3.5" />} checked={specialReqs.honeymoon} onChange={(v) => setSpecialReqs((p) => ({ ...p, honeymoon: v }))} />
//               <CheckFilter label="Senior-friendly" icon={<Briefcase className="h-3.5 w-3.5" />} checked={specialReqs.seniorFriendly} onChange={(v) => setSpecialReqs((p) => ({ ...p, seniorFriendly: v }))} />
//             </div>
//           </FilterSection>

//           <div className="h-6" />
//         </div>

//         {/* Apply button */}
//         <div className="border-t p-4" style={{ borderColor: "var(--glass-border)" }}>
//           <button
//             className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
//             style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
//           >
//             Apply Filters
//           </button>
//         </div>
//       </aside>
//     </>
//   );
// }



"use client";

import React, { useMemo, useState } from "react";
import {
  Plane,
  Accessibility,
  Coffee,
  Wifi,
  Baby,
  Dog,
  Heart,
  Users,
  Briefcase,
  Sparkles,
  ChevronDown,
  SlidersHorizontal,
  IndianRupee,
  Clock,
  MapPin,
  Utensils,
  Dumbbell,
  Waves,
  X,
  Calendar,
  Car,
  BadgePercent,
  Rainbow,
  Mountain,
} from "lucide-react";

/** =========================
 * Types
 * ========================= */
export type TripPace = "Relaxed" | "Balanced" | "Packed";

export type TravellerType = "Solo" | "Couple" | "Family" | "Friends" | "Business";

export type DestinationVibe =
  | "Beach"
  | "Hills"
  | "Desert"
  | "City"
  | "Forest"
  | "Snow"
  | "Backwaters"
  | "Island";

export type AccommodationType =
  | "Hotel"
  | "Hostel"
  | "Resort"
  | "Villa"
  | "Boutique"
  | "Camping"
  | "Homestay";

export type ActivityTag =
  | "Adventure"
  | "Culture"
  | "Nightlife"
  | "Shopping"
  | "Nature"
  | "Wellness"
  | "Water Sports"
  | "Photography"
  | "Pilgrimage"
  | "Wildlife";

export type DiningTag =
  | "Veg only"
  | "Street food"
  | "Fine dining"
  | "Rooftop dining"
  | "All-inclusive meals";

export type LocalTransportTag = "Airport transfer" | "Car/bike rental" | "Metro access";

export type OfferTag = "EMI" | "UPI cashback" | "Last-minute deals" | "Group discounts";

export interface SmartFilterValue {
  // Budget & duration
  budget: [number, number]; // INR per person
  durationDays: [number, number]; // 1-21
  people: {
    adults: number;
    children: number;
  };

  // People + vibes + pace + month
  travellerTypes: TravellerType[]; // multi-select
  tripPace?: TripPace;
  travelMonths: number[]; // 1..12 (multi-select)
  destinationVibes: DestinationVibe[]; // multi-select

  // Flights / transport prefs
  flights: {
    directOnly: boolean;
    earlyMorning: boolean;
    redEye: boolean;
    flexiblePlusMinus2Days: boolean;
  };

  // Stay preferences
  stay: {
    highlyRated: boolean;
    refundable: boolean;
    breakfastIncluded: boolean;
    freeWifi: boolean;
    poolSpa: boolean;
    gym: boolean;
  };

  accommodationTypes: AccommodationType[];

  // Food & dining
  dining: Record<DiningTag, boolean>;

  // Activities
  activities: Record<ActivityTag, boolean>;

  // Local transport
  localTransport: Record<LocalTransportTag, boolean>;

  // Special requirements
  special: {
    wheelchairAccessible: boolean;
    petFriendly: boolean;
    childFriendly: boolean;
    lgbtqWelcoming: boolean;
    honeymoonSpecial: boolean;
    seniorFriendly: boolean;
  };

  // Payment & offers
  offers: Record<OfferTag, boolean>;
}

/** Default values shown on first load. */
export const DEFAULT_SMART_FILTERS: SmartFilterValue = {
  budget: [5000, 60000],
  durationDays: [1, 7],
  people: {
    adults: 2,
    children: 0,
  },

  travellerTypes: ["Couple"],
  tripPace: "Balanced",
  travelMonths: [],
  destinationVibes: ["Beach", "City"],

  flights: {
    directOnly: false,
    earlyMorning: false,
    redEye: false,
    flexiblePlusMinus2Days: false,
  },

  stay: {
    highlyRated: true,
    refundable: false,
    breakfastIncluded: true,
    freeWifi: false,
    poolSpa: false,
    gym: false,
  },

  accommodationTypes: [],

  dining: {
    "Veg only": false,
    "Street food": false,
    "Fine dining": false,
    "Rooftop dining": false,
    "All-inclusive meals": false,
  },

  activities: {
    Adventure: false,
    Culture: false,
    Nightlife: false,
    Shopping: false,
    Nature: false,
    Wellness: false,
    "Water Sports": false,
    Photography: false,
    Pilgrimage: false,
    Wildlife: false,
  },

  localTransport: {
    "Airport transfer": false,
    "Car/bike rental": false,
    "Metro access": false,
  },

  special: {
    wheelchairAccessible: false,
    petFriendly: false,
    childFriendly: false,
    lgbtqWelcoming: false,
    honeymoonSpecial: false,
    seniorFriendly: false,
  },

  offers: {
    EMI: false,
    "UPI cashback": false,
    "Last-minute deals": false,
    "Group discounts": false,
  },
};

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function FilterSection({ title, icon, defaultOpen = false, children }: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="mb-2 rounded-xl border px-3 py-2"
      style={{
        borderColor: "var(--glass-border)",
        background: "color-mix(in oklch, var(--surface-soft) 76%, white 24%)",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-2 text-sm font-semibold transition-colors"
        style={{ color: "var(--foreground)" }}
        type="button"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <ChevronDown
          className="h-4 w-4 transition-transform duration-200"
          style={{
            color: "var(--muted-foreground)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
      {open && <div className="overflow-hidden pt-2 pb-1">{children}</div>}
    </div>
  );
}

interface CheckFilterProps {
  label: string;
  icon?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function CheckFilter({ label, icon, checked, onChange }: CheckFilterProps) {
  return (
    <label
      className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm transition-colors"
      style={
        checked
          ? {
              borderColor: "color-mix(in oklch, var(--primary) 64%, white 36%)",
              background: "color-mix(in oklch, var(--primary) 18%, transparent)",
              color: "var(--foreground)",
            }
          : {
              borderColor: "var(--glass-border)",
              background: "var(--glass)",
              color: "var(--muted-foreground)",
            }
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded accent-[oklch(0.7_0.15_200)]"
      />
      {icon && <span style={{ color: "var(--muted-foreground)" }}>{icon}</span>}
      <span>{label}</span>
    </label>
  );
}

function MonthGrid({
  selected,
  onToggleMonth,
}: {
  selected: number[];
  onToggleMonth: (month: number) => void;
}) {
  const months = useMemo(
    () => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    []
  );

  return (
    <div className="grid grid-cols-4 gap-2">
      {months.map((m, idx) => {
        const monthNum = idx + 1;
        const active = selected.includes(monthNum);
        return (
          <button
            key={m}
            type="button"
            onClick={() => onToggleMonth(monthNum)}
            className="rounded-lg border px-2 py-2 text-xs font-semibold transition-all"
            style={
              active
                ? {
                    borderColor: "color-mix(in oklch, var(--primary) 64%, white 36%)",
                    background: "color-mix(in oklch, var(--primary) 20%, transparent)",
                    color: "var(--foreground)",
                  }
                : {
                    borderColor: "var(--glass-border)",
                    background: "color-mix(in oklch, var(--surface-soft) 82%, white 18%)",
                    color: "var(--muted-foreground)",
                  }
            }
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}

/** =========================
 * Component
 * ========================= */
interface SmartFiltersProps {
  /** Mobile drawer state */
  open?: boolean;
  onClose?: () => void;
  embedded?: boolean;

  /** Trip dates controlled from search page */
  tripDates: {
    checkIn: string;
    checkOut: string;
  };
  onTripDatesChange: (next: { checkIn: string; checkOut: string }) => void;

  /** Controlled filter state */
  value: SmartFilterValue;
  onChange: (next: SmartFilterValue) => void;

  /** Optional baseline/reset state for dynamic query-derived defaults */
  baselineValue?: SmartFilterValue;
  resetValue?: SmartFilterValue;

  /** Called when user taps Apply */
  onApply: (next: SmartFilterValue, tripDates: { checkIn: string; checkOut: string }) => void;

  /** Optional "inferred" partial filters from query parsing */
  inferred?: Partial<SmartFilterValue>;
}

export function SmartFilters({
  open: mobileOpen = true,
  onClose,
  embedded = false,
  tripDates,
  onTripDatesChange,
  value,
  onChange,
  baselineValue,
  resetValue,
  onApply,
}: SmartFiltersProps) {
  const fmt = (v: number) => {
    if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
    return String(v);
  };

  // Helpers
  const update = (patch: Partial<SmartFilterValue>) => onChange({ ...value, ...patch });
  const updateTripDates = (patch: Partial<{ checkIn: string; checkOut: string }>) =>
    onTripDatesChange({ ...tripDates, ...patch });

  const toggleInArray = <T,>(arr: T[], item: T) => (arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);

  const toggleRecord = <K extends string>(rec: Record<K, boolean>, key: K) => ({ ...rec, [key]: !rec[key] });

  const travellerOptions: TravellerType[] = ["Solo", "Couple", "Family", "Friends", "Business"];
  const vibeOptions: DestinationVibe[] = ["Beach", "Hills", "Desert", "City", "Forest", "Snow", "Backwaters", "Island"];
  const paceOptions: TripPace[] = ["Relaxed", "Balanced", "Packed"];

  const accommodationOptions: AccommodationType[] = ["Hotel", "Hostel", "Resort", "Villa", "Boutique", "Camping", "Homestay"];

  const activityOptions: ActivityTag[] = [
    "Adventure",
    "Culture",
    "Nightlife",
    "Shopping",
    "Nature",
    "Wellness",
    "Water Sports",
    "Photography",
    "Pilgrimage",
    "Wildlife",
  ];

  const diningOptions: DiningTag[] = ["Veg only", "Street food", "Fine dining", "Rooftop dining", "All-inclusive meals"];

  const localTransportOptions: LocalTransportTag[] = ["Airport transfer", "Car/bike rental", "Metro access"];

  const offerOptions: OfferTag[] = ["EMI", "UPI cashback", "Last-minute deals", "Group discounts"];
  const baseline = baselineValue ?? DEFAULT_SMART_FILTERS;
  const resetTo = resetValue ?? DEFAULT_SMART_FILTERS;

  const pillStyle = (active: boolean) =>
    active
      ? {
          borderColor: "color-mix(in oklch, var(--primary) 64%, white 36%)",
          background: "color-mix(in oklch, var(--primary) 20%, transparent)",
          color: "var(--foreground)",
        }
      : {
          borderColor: "var(--glass-border)",
          background: "color-mix(in oklch, var(--surface-soft) 82%, white 18%)",
          color: "var(--muted-foreground)",
        };

  const fieldStyle = {
    borderColor: "var(--glass-border)",
    background: "color-mix(in oklch, var(--card) 84%, white 16%)",
    color: "var(--foreground)",
  } as const;

  const activeCount = useMemo(() => {
    const arrayDeltaCount = <T,>(current: T[], base: T[]) => current.filter((item) => !base.includes(item)).length;
    const boolRecordDeltaCount = (current: Record<string, boolean>, base: Record<string, boolean>) =>
      Object.keys(current).filter((k) => Boolean(current[k]) !== Boolean(base[k])).length;

    let c = 0;
    if (value.budget[0] !== baseline.budget[0] || value.budget[1] !== baseline.budget[1]) c++;
    if (value.durationDays[0] !== baseline.durationDays[0] || value.durationDays[1] !== baseline.durationDays[1]) c++;
    if (value.people.adults !== baseline.people.adults || value.people.children !== baseline.people.children) c++;

    c += arrayDeltaCount(value.travellerTypes, baseline.travellerTypes);
    c += arrayDeltaCount(value.destinationVibes, baseline.destinationVibes);
    if ((value.tripPace || undefined) !== (baseline.tripPace || undefined)) c++;
    c += arrayDeltaCount(value.travelMonths, baseline.travelMonths);

    c += boolRecordDeltaCount(value.flights, baseline.flights);
    c += boolRecordDeltaCount(value.stay, baseline.stay);
    c += arrayDeltaCount(value.accommodationTypes, baseline.accommodationTypes);

    c += boolRecordDeltaCount(value.dining, baseline.dining);
    c += boolRecordDeltaCount(value.activities, baseline.activities);
    c += boolRecordDeltaCount(value.localTransport, baseline.localTransport);
    c += boolRecordDeltaCount(value.special, baseline.special);
    c += boolRecordDeltaCount(value.offers, baseline.offers);
    return c;
  }, [value, baseline]);

  const isOpen = embedded ? true : mobileOpen;

  return (
    <>
      {/* Overlay for standalone mode */}
      {!embedded && isOpen && onClose && (
        <div
          className="fixed inset-0 z-30"
          style={{ background: "var(--scrim)", backdropFilter: "blur(8px)" }}
          onClick={onClose}
        />
      )}

      <aside
        className={
          embedded
            ? "flex h-full w-full flex-col"
            : `fixed top-0 right-0 z-40 flex h-screen w-80 flex-col border-l transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`
        }
        style={{
          borderColor: "var(--glass-border)",
          background:
            "linear-gradient(155deg, color-mix(in oklch, var(--surface-strong) 86%, white 14%), color-mix(in oklch, var(--surface-soft) 80%, white 20%))",
          backdropFilter: "blur(24px)",
          boxShadow: "0 28px 52px oklch(0.14 0.03 240 / 0.18), inset 0 1px 0 oklch(1 0 0 / 0.55)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{
            borderColor: "var(--glass-border)",
            background:
              "linear-gradient(140deg, color-mix(in oklch, var(--surface-strong) 88%, white 12%), color-mix(in oklch, var(--surface-soft) 84%, white 16%))",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg border"
              style={{
                borderColor: "var(--glass-border)",
                background: "color-mix(in oklch, var(--primary) 14%, transparent)",
              }}
            >
              <SlidersHorizontal className="h-4 w-4" style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                Smart Filters
              </h2>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {activeCount} active • refine your search
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="voyager-btn-secondary rounded-lg px-2 py-1 text-xs"
              style={{ color: "var(--muted-foreground)" }}
              onClick={() => onChange(resetTo)}
              title="Reset filters"
            >
              Reset
            </button>
            {onClose && (
              <button onClick={onClose} style={{ color: "var(--muted-foreground)" }} type="button">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {/* Budget & Duration */}
          <FilterSection title="Budget & Duration" icon={<IndianRupee className="h-4 w-4" style={{ color: "var(--primary)" }} />} defaultOpen>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs" style={{ color: "var(--muted-foreground)" }}>
                  <span>Budget (per person)</span>
                  <span className="font-mono" style={{ color: "var(--foreground)" }}>
                    {fmt(value.budget[0])} – {fmt(value.budget[1])}
                  </span>
                </div>
                <input
                  type="range"
                  min={5000}
                  max={100000}
                  step={1000}
                  value={value.budget[1]}
                  onChange={(e) => update({ budget: [value.budget[0], Number(e.target.value)] })}
                  className="w-full accent-[oklch(0.7_0.15_200)]"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-xs" style={{ color: "var(--muted-foreground)" }}>
                  <span>Trip Duration</span>
                  <span className="font-mono" style={{ color: "var(--foreground)" }}>
                    {value.durationDays[0]} – {value.durationDays[1]} days
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={21}
                  step={1}
                  value={value.durationDays[1]}
                  onChange={(e) => update({ durationDays: [value.durationDays[0], Number(e.target.value)] })}
                  className="w-full accent-[oklch(0.7_0.15_200)]"
                />
              </div>
            </div>
          </FilterSection>

          <FilterSection title="Trip Dates" icon={<Calendar className="h-4 w-4" style={{ color: "var(--primary)" }} />} defaultOpen>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={tripDates.checkIn}
                  onChange={(e) => updateTripDates({ checkIn: e.target.value })}
                  className="w-full rounded-lg border px-2 py-1.5 text-sm"
                  style={fieldStyle}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--muted-foreground)" }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={tripDates.checkOut}
                  onChange={(e) => updateTripDates({ checkOut: e.target.value })}
                  className="w-full rounded-lg border px-2 py-1.5 text-sm"
                  style={fieldStyle}
                />
              </div>
            </div>
          </FilterSection>

          {/* Who's Travelling */}
          <FilterSection title="Who's Travelling?" icon={<Users className="h-4 w-4" style={{ color: "var(--primary)" }} />} defaultOpen>
            <div className="flex flex-wrap gap-1.5">
              {travellerOptions.map((t) => {
                const active = value.travellerTypes.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update({ travellerTypes: toggleInArray(value.travellerTypes, t) })}
                    className="rounded-full border px-3 py-1 text-xs font-medium transition-all"
                    style={pillStyle(active)}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </FilterSection>

          <FilterSection title="Number of People" icon={<Users className="h-4 w-4" style={{ color: "var(--primary)" }} />} defaultOpen>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Adults
                </label>
                <input
                  type="number"
                  min={1}
                  max={9}
                  value={value.people.adults}
                  onChange={(e) =>
                    update({
                      people: {
                        ...value.people,
                        adults: Math.min(9, Math.max(1, Number(e.target.value) || 1)),
                      },
                    })
                  }
                  className="w-full rounded-lg border px-2 py-1.5 text-sm"
                  style={fieldStyle}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Children
                </label>
                <input
                  type="number"
                  min={0}
                  max={6}
                  value={value.people.children}
                  onChange={(e) =>
                    update({
                      people: {
                        ...value.people,
                        children: Math.min(6, Math.max(0, Number(e.target.value) || 0)),
                      },
                    })
                  }
                  className="w-full rounded-lg border px-2 py-1.5 text-sm"
                  style={fieldStyle}
                />
              </div>
            </div>
          </FilterSection>

          {/* Trip pace */}
          <FilterSection title="Trip Pace" icon={<Sparkles className="h-4 w-4" style={{ color: "var(--primary)" }} />} defaultOpen>
            <div className="flex flex-wrap gap-1.5">
              {paceOptions.map((p) => {
                const active = value.tripPace === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => update({ tripPace: active ? undefined : p })}
                    className="rounded-full border px-3 py-1 text-xs font-medium transition-all"
                    style={pillStyle(active)}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </FilterSection>

          {/* Travel Month */}
          <FilterSection title="Travel Month" icon={<Calendar className="h-4 w-4" style={{ color: "var(--primary)" }} />} defaultOpen>
            <MonthGrid
              selected={value.travelMonths}
              onToggleMonth={(month) => update({ travelMonths: toggleInArray(value.travelMonths, month) })}
            />
          </FilterSection>

          {/* Destination Vibe */}
          <FilterSection title="Destination Vibe" icon={<MapPin className="h-4 w-4" style={{ color: "var(--primary)" }} />} defaultOpen>
            <div className="flex flex-wrap gap-1.5">
              {vibeOptions.map((v) => {
                const active = value.destinationVibes.includes(v);
                const Icon = v === "Hills" ? Mountain : MapPin;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => update({ destinationVibes: toggleInArray(value.destinationVibes, v) })}
                    className="rounded-full border px-3 py-1 text-xs font-medium transition-all inline-flex items-center gap-1"
                    style={pillStyle(active)}
                  >
                    <Icon className="h-3 w-3" />
                    {v}
                  </button>
                );
              })}
            </div>
          </FilterSection>

          {/* Flights */}
          <FilterSection title="Flights" icon={<Plane className="h-4 w-4" style={{ color: "var(--primary)" }} />}>
            <div className="space-y-0.5">
              <CheckFilter
                label="Direct flights only"
                icon={<Plane className="h-3.5 w-3.5" />}
                checked={value.flights.directOnly}
                onChange={(v) => update({ flights: { ...value.flights, directOnly: v } })}
              />
              <CheckFilter
                label="Early morning"
                icon={<Clock className="h-3.5 w-3.5" />}
                checked={value.flights.earlyMorning}
                onChange={(v) => update({ flights: { ...value.flights, earlyMorning: v } })}
              />
              <CheckFilter
                label="Red-eye"
                icon={<Clock className="h-3.5 w-3.5" />}
                checked={value.flights.redEye}
                onChange={(v) => update({ flights: { ...value.flights, redEye: v } })}
              />
              <CheckFilter
                label="Flexible ±2 days"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                checked={value.flights.flexiblePlusMinus2Days}
                onChange={(v) => update({ flights: { ...value.flights, flexiblePlusMinus2Days: v } })}
              />
            </div>
          </FilterSection>

          {/* Stay */}
          <FilterSection title="Stay Preferences" icon={<Coffee className="h-4 w-4" style={{ color: "var(--primary)" }} />}>
            <div className="space-y-0.5">
              <CheckFilter
                label="Highly rated (4.5+)"
                checked={value.stay.highlyRated}
                onChange={(v) => update({ stay: { ...value.stay, highlyRated: v } })}
              />
              <CheckFilter
                label="Free cancellation (refundable)"
                checked={value.stay.refundable}
                onChange={(v) => update({ stay: { ...value.stay, refundable: v } })}
              />
              <CheckFilter
                label="Breakfast included"
                icon={<Coffee className="h-3.5 w-3.5" />}
                checked={value.stay.breakfastIncluded}
                onChange={(v) => update({ stay: { ...value.stay, breakfastIncluded: v } })}
              />
              <CheckFilter
                label="Free Wi-Fi"
                icon={<Wifi className="h-3.5 w-3.5" />}
                checked={value.stay.freeWifi}
                onChange={(v) => update({ stay: { ...value.stay, freeWifi: v } })}
              />
              <CheckFilter
                label="Pool / Spa"
                icon={<Waves className="h-3.5 w-3.5" />}
                checked={value.stay.poolSpa}
                onChange={(v) => update({ stay: { ...value.stay, poolSpa: v } })}
              />
              <CheckFilter
                label="Gym / Fitness"
                icon={<Dumbbell className="h-3.5 w-3.5" />}
                checked={value.stay.gym}
                onChange={(v) => update({ stay: { ...value.stay, gym: v } })}
              />
            </div>
          </FilterSection>

          {/* Accommodation type */}
          <FilterSection title="Accommodation Type" icon={<Briefcase className="h-4 w-4" style={{ color: "var(--primary)" }} />}>
            <div className="flex flex-wrap gap-1.5">
              {accommodationOptions.map((a) => {
                const active = value.accommodationTypes.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => update({ accommodationTypes: toggleInArray(value.accommodationTypes, a) })}
                    className="rounded-full border px-3 py-1 text-xs font-medium transition-all"
                    style={pillStyle(active)}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </FilterSection>

          {/* Dining */}
          <FilterSection title="Food & Dining" icon={<Utensils className="h-4 w-4" style={{ color: "var(--primary)" }} />}>
            <div className="space-y-0.5">
              {diningOptions.map((k) => (
                <CheckFilter
                  key={k}
                  label={k}
                  checked={value.dining[k]}
                  onChange={() => update({ dining: toggleRecord(value.dining, k) })}
                />
              ))}
            </div>
          </FilterSection>

          {/* Activities */}
          <FilterSection title="Activities" icon={<Sparkles className="h-4 w-4" style={{ color: "var(--primary)" }} />}>
            <div className="flex flex-wrap gap-1.5">
              {activityOptions.map((k) => {
                const active = value.activities[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => update({ activities: toggleRecord(value.activities, k) })}
                    className="rounded-full border px-3 py-1 text-xs font-medium transition-all"
                    style={pillStyle(active)}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </FilterSection>

          {/* Local transport */}
          <FilterSection title="Local Transport" icon={<Car className="h-4 w-4" style={{ color: "var(--primary)" }} />}>
            <div className="space-y-0.5">
              {localTransportOptions.map((k) => (
                <CheckFilter
                  key={k}
                  label={k}
                  checked={value.localTransport[k]}
                  onChange={() => update({ localTransport: toggleRecord(value.localTransport, k) })}
                />
              ))}
            </div>
          </FilterSection>

          {/* Special */}
          <FilterSection title="Special Requirements" icon={<Accessibility className="h-4 w-4" style={{ color: "var(--primary)" }} />}>
            <div className="space-y-0.5">
              <CheckFilter
                label="Wheelchair accessible"
                icon={<Accessibility className="h-3.5 w-3.5" />}
                checked={value.special.wheelchairAccessible}
                onChange={(v) => update({ special: { ...value.special, wheelchairAccessible: v } })}
              />
              <CheckFilter
                label="Pet-friendly"
                icon={<Dog className="h-3.5 w-3.5" />}
                checked={value.special.petFriendly}
                onChange={(v) => update({ special: { ...value.special, petFriendly: v } })}
              />
              <CheckFilter
                label="Child-friendly"
                icon={<Baby className="h-3.5 w-3.5" />}
                checked={value.special.childFriendly}
                onChange={(v) => update({ special: { ...value.special, childFriendly: v } })}
              />
              <CheckFilter
                label="LGBTQ+ welcoming"
                icon={<Rainbow className="h-3.5 w-3.5" />}
                checked={value.special.lgbtqWelcoming}
                onChange={(v) => update({ special: { ...value.special, lgbtqWelcoming: v } })}
              />
              <CheckFilter
                label="Honeymoon special"
                icon={<Heart className="h-3.5 w-3.5" />}
                checked={value.special.honeymoonSpecial}
                onChange={(v) => update({ special: { ...value.special, honeymoonSpecial: v } })}
              />
              <CheckFilter
                label="Senior-friendly"
                icon={<Briefcase className="h-3.5 w-3.5" />}
                checked={value.special.seniorFriendly}
                onChange={(v) => update({ special: { ...value.special, seniorFriendly: v } })}
              />
            </div>
          </FilterSection>

          {/* Payment & offers */}
          <FilterSection title="Payment & Offers" icon={<BadgePercent className="h-4 w-4" style={{ color: "var(--primary)" }} />}>
            <div className="space-y-0.5">
              {offerOptions.map((k) => (
                <CheckFilter key={k} label={k} checked={value.offers[k]} onChange={() => update({ offers: toggleRecord(value.offers, k) })} />
              ))}
            </div>
          </FilterSection>

          <div className="h-6" />
        </div>

        {/* Apply button */}
        <div
          className="border-t p-4"
          style={{
            borderColor: "var(--glass-border)",
            background: "color-mix(in oklch, var(--surface-strong) 86%, white 14%)",
          }}
        >
          <button
            type="button"
            onClick={() => onApply(value, tripDates)}
            className="voyager-btn-primary w-full rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
            style={{ color: "var(--primary-foreground)" }}
          >
            Apply Filters
          </button>
        </div>
      </aside>
    </>
  );
}
