import { NextRequest, NextResponse } from "next/server";
import { searchFlights, getAirInventoryDebug } from "@/lib/tbo-api";
import { parseQueryWithGemini } from "@/lib/query-parser-ai";

const DEFAULT_SOURCE_CITY = "Delhi";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") || "";
  const fromOverride = searchParams.get("from");
  const toOverride = searchParams.get("to");
  const dateOverride = searchParams.get("checkIn") || undefined;
  const adultsOverride = Number(searchParams.get("adults") || "");
  const childrenOverride = Number(searchParams.get("children") || "");

  try {
    const parsed = await parseQueryWithGemini(rawQuery);
    const from = (fromOverride || parsed.from || "").trim() || DEFAULT_SOURCE_CITY;
    const parsedDestination = (parsed.destination || parsed.to || "").trim();
    let to = (toOverride || parsedDestination || "").trim();
    if (to && to.toLowerCase() === from.toLowerCase() && parsedDestination.toLowerCase() !== from.toLowerCase()) {
      to = parsedDestination;
    }
    const adults = Number.isFinite(adultsOverride) && adultsOverride > 0 ? Math.floor(adultsOverride) : parsed.adults;
    const children =
      Number.isFinite(childrenOverride) && childrenOverride >= 0 ? Math.floor(childrenOverride) : parsed.children;

    if (!from || !to || from.toLowerCase() === to.toLowerCase()) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: { from, to, parsed },
      });
    }

    const journeyDate = dateOverride || parsed.checkIn;
    const flights = await searchFlights(from, to, journeyDate, adults, children);
    const airInventory = getAirInventoryDebug(from, to, journeyDate);

    return NextResponse.json({
      success: true,
      data: flights,
      meta: { from, to, adults, children, date: journeyDate, airInventory, parsed },
    });
  } catch (err) {
    console.error("Flight search error:", err);
    return NextResponse.json(
      { error: "Failed to fetch flights", details: String(err) },
      { status: 500 }
    );
  }
}
