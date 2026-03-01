import { NextRequest, NextResponse } from "next/server";
import { searchHotels, getHotelInventoryDebug } from "@/lib/tbo-api";
import { parseQueryWithGemini } from "@/lib/query-parser-ai";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") || "";
  const query = rawQuery.trim();
  const cityOverride = searchParams.get("city");

  if (!query && !cityOverride) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  try {
    const parsed = await parseQueryWithGemini(rawQuery);
    const cityName = (cityOverride || parsed.destination || parsed.to || "").trim();

    if (!cityName) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: { parsed, cityName: "" },
      });
    }

    const hotels = await searchHotels({
      cityName,
      checkIn: parsed.checkIn,
      checkOut: parsed.checkOut,
      adults: parsed.adults,
      children: parsed.children,
      rooms: 1,
      currency: "INR",
    });
    const hotelInventory = getHotelInventoryDebug(cityName);

    return NextResponse.json({
      success: true,
      data: hotels,
      meta: { parsed, cityName, hotelInventory },
    });
  } catch (err) {
    console.error("Hotel search error:", err);
    return NextResponse.json(
      { error: "Failed to fetch hotels", details: String(err) },
      { status: 500 }
    );
  }
}
