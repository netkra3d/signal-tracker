import { NextResponse } from "next/server";

type UpbitCandleResponse = {
  candle_date_time_utc: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume: number;
};

type UpbitTickerResponse = Array<{
  trade_price: number;
  prev_closing_price: number;
  market_state: string;
  timestamp: number;
}>;

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const url = new URL(request.url);
  const count = Number(url.searchParams.get("count") ?? "200");

  const [candlesResponse, tickerResponse] = await Promise.all([
    fetch(`https://api.upbit.com/v1/candles/minutes/240?market=${encodeURIComponent(symbol)}&count=${count}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
    fetch(`https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(symbol)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
  ]);

  if (!candlesResponse.ok) {
    return NextResponse.json({ message: "Failed to load Upbit 240m candles." }, { status: candlesResponse.status });
  }

  if (!tickerResponse.ok) {
    return NextResponse.json({ message: "Failed to load Upbit quote." }, { status: tickerResponse.status });
  }

  const candleData = (await candlesResponse.json()) as UpbitCandleResponse[];
  const tickerData = (await tickerResponse.json()) as UpbitTickerResponse;
  const ticker = tickerData[0];

  const candles = candleData
    .map((item) => ({
      time: `${item.candle_date_time_utc}Z`,
      open: item.opening_price,
      high: item.high_price,
      low: item.low_price,
      close: item.trade_price,
      volume: item.candle_acc_trade_volume,
    }))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return NextResponse.json({
    symbol,
    timeframe: "240m",
    candles,
    quote: ticker
      ? {
          assetCode: symbol,
          price: ticker.trade_price,
          currency: "KRW",
          timestamp: new Date(ticker.timestamp).toISOString(),
          source: "upbit",
          isMarketOpen: ticker.market_state === "ACTIVE",
          previousClose: ticker.prev_closing_price,
        }
      : null,
  });
}
