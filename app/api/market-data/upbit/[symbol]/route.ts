import { NextResponse } from "next/server";

type UpbitCandleResponse = {
  candle_date_time_utc: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume: number;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const url = new URL(request.url);
  const count = Number(url.searchParams.get("count") ?? "200");

  const upstream = await fetch(
    `https://api.upbit.com/v1/candles/minutes/60?market=${encodeURIComponent(symbol)}&count=${count}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }
  );

  if (!upstream.ok) {
    return NextResponse.json({ message: "업비트 데이터를 가져오지 못했습니다." }, { status: upstream.status });
  }

  const data = (await upstream.json()) as UpbitCandleResponse[];
  const candles = data
    .map((item) => ({
      time: `${item.candle_date_time_utc}Z`,
      open: item.opening_price,
      high: item.high_price,
      low: item.low_price,
      close: item.trade_price,
      volume: item.candle_acc_trade_volume,
    }))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return NextResponse.json({ symbol, candles });
}

