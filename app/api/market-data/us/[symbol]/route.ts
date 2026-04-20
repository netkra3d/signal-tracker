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
  datetime?: string;
  close?: string;
  previous_close?: string;
  timestamp?: number;
  exchange?: string;
  is_market_open?: boolean;
  is_extended_hours?: boolean;
  status?: string;
  code?: number;
  message?: string;
};

export const dynamic = "force-dynamic";

function parseNumber(value: string | number | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchQuote(symbol: string, apiKey: string) {
  const extendedUrl = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&interval=30min&prepost=true&apikey=${encodeURIComponent(apiKey)}`;
  const regularUrl = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&interval=4h&apikey=${encodeURIComponent(apiKey)}`;

  const extendedResponse = await fetch(extendedUrl, { cache: "no-store" });
  if (extendedResponse.ok) {
    const extendedData = (await extendedResponse.json()) as TwelveQuoteResponse;
    if (extendedData.status !== "error") {
      return extendedData;
    }
  }

  const regularResponse = await fetch(regularUrl, { cache: "no-store" });
  if (!regularResponse.ok) {
    throw new Error("Failed to load US ETF quote.");
  }

  return (await regularResponse.json()) as TwelveQuoteResponse;
}

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: "TWELVE_DATA_API_KEY is missing." }, { status: 503 });
  }

  const { symbol } = await params;
  const url = new URL(request.url);
  const count = Number(url.searchParams.get("count") ?? "200");

  const [seriesResponse, quoteData] = await Promise.all([
    fetch(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=4h&outputsize=${count}&order=asc&timezone=America/New_York&apikey=${encodeURIComponent(apiKey)}`,
      { cache: "no-store" }
    ),
    fetchQuote(symbol, apiKey),
  ]);

  if (!seriesResponse.ok) {
    return NextResponse.json({ message: "Failed to load US ETF 240m candles." }, { status: seriesResponse.status });
  }

  const seriesData = (await seriesResponse.json()) as TwelveTimeSeriesResponse;

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
    : quoteData.datetime
      ? new Date(quoteData.datetime.replace(" ", "T")).toISOString()
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
      source: quoteData.exchange
        ? `twelve-data:${quoteData.exchange}${quoteData.is_extended_hours ? ":extended" : ""}`
        : quoteData.is_extended_hours
          ? "twelve-data:extended"
          : "twelve-data",
      isMarketOpen: Boolean(quoteData.is_market_open),
      isExtendedHours: Boolean(quoteData.is_extended_hours),
      previousClose: quoteData.previous_close ? parseNumber(quoteData.previous_close) : null,
    },
  });
}
