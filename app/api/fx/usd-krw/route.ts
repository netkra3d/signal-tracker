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
    return NextResponse.json({ message: "환율 데이터를 가져오지 못했습니다." }, { status: upstream.status });
  }

  const data = (await upstream.json()) as FrankfurterResponse;

  return NextResponse.json({
    base: "USD",
    quote: "KRW",
    rate: data.rates.KRW,
    fetchedAt: new Date().toISOString(),
  });
}
