import { NextResponse } from "next/server";

type FrankfurterResponse = {
  rates: {
    KRW: number;
  };
};

export const dynamic = "force-dynamic";

export async function GET() {
  const upstream = await fetch("https://api.frankfurter.app/latest?from=USD&to=KRW", {
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json({ message: "Failed to load USD/KRW rate." }, { status: upstream.status });
  }

  const data = (await upstream.json()) as FrankfurterResponse;

  return NextResponse.json({
    base: "USD",
    quote: "KRW",
    rate: data.rates.KRW,
    fetchedAt: new Date().toISOString(),
  });
}
