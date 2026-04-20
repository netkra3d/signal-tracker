import { NextResponse } from "next/server";

type TwelveTimeSeriesValue = {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
};

type TwelveTimeSeriesResponse = {
  values?: TwelveTimeSeriesValue[];
  status?: string;
  code?: number;
  message?: string;
};

type TwelveQuoteResponse = {
  close?: string;
  previous_close?: string;
  timestamp?: number;
  exchange?: string;
  is_market_open?: boolean;
  status?: string;
  code?: number;
  message?: string;
};

export const dynamic = "force-dynamic";

function parseNumber(value: string | number | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: "TWELVE_DATA_API_KEY is missing." }, { status: 503 });
  }

  const { symbol } = await params;
  const url = new URL(request.url);
  const count = Number(url.searchParams.get("count") ?? "200");

  const [seriesResponse, quoteResponse] = await Promise.all([
    fetch(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=4h&outputsize=${count}&order=asc&timezone=America/New_York&apikey=${encodeURIComponent(apiKey)}`,
      { cache: "no-store" }
    ),
    fetch(
      `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&interval=4h&apikey=${encodeURIComponent(apiKey)}`,
      { cache: "no-store" }
    ),
  ]);

  if (!seriesResponse.ok) {
    return NextResponse.json({ message: "Failed to load US ETF 240m candles." }, { status: seriesResponse.status });
  }

  if (!quoteResponse.ok) {
    return NextResponse.json({ message: "Failed to load US ETF quote." }, { status: quoteResponse.status });
  }

  const seriesData = (await seriesResponse.json()) as TwelveTimeSeriesResponse;
  const quoteData = (await quoteResponse.json()) as TwelveQuoteResponse;

  if (!seriesData.values || seriesData.status === "error") {
    return NextResponse.json({ message: seriesData.message ?? "US ETF time series error." }, { status: 502 });
  }

  if (quoteData.status === "error") {
    return NextResponse.json({ message: quoteData.message ?? "US ETF quote error." }, { status: 502 });
  }

  const candles = seriesData.values.map((item) => ({
    time: new Date(item.datetime.replace(" ", "T")).toISOString(),
    open: parseNumber(item.open),
    high: parseNumber(item.high),
    low: parseNumber(item.low),
    close: parseNumber(item.close),
    volume: parseNumber(item.volume),
  }));

  const latestTimestamp = quoteData.timestamp
    ? new Date(quoteData.timestamp * 1000).toISOString()
    : candles.at(-1)?.time ?? new Date().toISOString();

  return NextResponse.json({
    symbol,
    timeframe: "240m",
    candles,
    quote: {
      assetCode: symbol,
      price: parseNumber(quoteData.close ?? candles.at(-1)?.close),
      currency: "USD",
      timestamp: latestTimestamp,
      source: quoteData.exchange ? `twelve-data:${quoteData.exchange}` : "twelve-data",
      isMarketOpen: Boolean(quoteData.is_market_open),
      previousClose: quoteData.previous_close ? parseNumber(quoteData.previous_close) : null,
    },
  });
}
