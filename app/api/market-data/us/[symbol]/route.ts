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

type YahooChartPeriod = {
  start: number;
  end: number;
  gmtoffset: number;
  timezone: string;
};

type YahooChartMeta = {
  regularMarketTime?: number;
  regularMarketPrice?: number;
  previousClose?: number;
  exchangeName?: string;
  currentTradingPeriod?: {
    pre?: YahooChartPeriod;
    regular?: YahooChartPeriod;
    post?: YahooChartPeriod;
  };
};

type YahooChartQuote = {
  close?: Array<number | null>;
};

type YahooChartResult = {
  meta?: YahooChartMeta;
  timestamp?: number[];
  indicators?: {
    quote?: YahooChartQuote[];
  };
};

type YahooChartResponse = {
  chart?: {
    result?: YahooChartResult[];
    error?: { description?: string } | null;
  };
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

async function fetchYahooExtendedQuote(symbol: string) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=true&events=div%2Csplits`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as YahooChartResponse;
  const result = data.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const meta = result?.meta;

  if (!meta || timestamps.length === 0 || closes.length === 0) {
    return null;
  }

  let latestPrice: number | null = null;
  let latestTimestamp: number | null = null;

  for (let index = closes.length - 1; index >= 0; index -= 1) {
    const close = closes[index];
    const timestamp = timestamps[index];
    if (typeof close === "number" && Number.isFinite(close) && typeof timestamp === "number") {
      latestPrice = close;
      latestTimestamp = timestamp;
      break;
    }
  }

  if (latestPrice === null || latestTimestamp === null) {
    return null;
  }

  const regular = meta.currentTradingPeriod?.regular;
  const pre = meta.currentTradingPeriod?.pre;
  const post = meta.currentTradingPeriod?.post;
  const isExtendedHours =
    (pre ? latestTimestamp >= pre.start && latestTimestamp < pre.end : false) ||
    (post ? latestTimestamp >= post.start && latestTimestamp < post.end : false);
  const isMarketOpen = regular ? latestTimestamp >= regular.start && latestTimestamp < regular.end : false;

  return {
    price: latestPrice,
    timestamp: new Date(latestTimestamp * 1000).toISOString(),
    isExtendedHours,
    isMarketOpen,
    source: meta.exchangeName ? `yahoo-finance-unofficial:${meta.exchangeName}` : "yahoo-finance-unofficial",
    previousClose: typeof meta.previousClose === "number" && Number.isFinite(meta.previousClose) ? meta.previousClose : null,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: "TWELVE_DATA_API_KEY is missing." }, { status: 503 });
  }

  const { symbol } = await params;
  const url = new URL(request.url);
  const count = Number(url.searchParams.get("count") ?? "200");

  const [seriesResponse, quoteData, yahooQuote] = await Promise.all([
    fetch(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=4h&outputsize=${count}&order=asc&timezone=America/New_York&apikey=${encodeURIComponent(apiKey)}`,
      { cache: "no-store" }
    ),
    fetchQuote(symbol, apiKey),
    fetchYahooExtendedQuote(symbol),
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

  const shouldUseYahooQuote =
    yahooQuote &&
    (yahooQuote.isExtendedHours ||
      new Date(yahooQuote.timestamp).getTime() > new Date(latestTimestamp).getTime());

  const finalPrice = shouldUseYahooQuote ? yahooQuote.price : parseNumber(quoteData.close ?? candles.at(-1)?.close);
  const finalTimestamp = shouldUseYahooQuote ? yahooQuote.timestamp : latestTimestamp;
  const finalSource = shouldUseYahooQuote
    ? `${yahooQuote.source}${yahooQuote.isExtendedHours ? ":extended" : ""}`
    : quoteData.exchange
      ? `twelve-data:${quoteData.exchange}${quoteData.is_extended_hours ? ":extended" : ""}`
      : quoteData.is_extended_hours
        ? "twelve-data:extended"
        : "twelve-data";
  const finalIsMarketOpen = shouldUseYahooQuote ? yahooQuote.isMarketOpen : Boolean(quoteData.is_market_open);
  const finalIsExtendedHours = shouldUseYahooQuote ? yahooQuote.isExtendedHours : Boolean(quoteData.is_extended_hours);
  const finalPreviousClose = shouldUseYahooQuote
    ? (yahooQuote.previousClose ?? (quoteData.previous_close ? parseNumber(quoteData.previous_close) : null))
    : quoteData.previous_close
      ? parseNumber(quoteData.previous_close)
      : null;

  return NextResponse.json({
    symbol,
    timeframe: "240m",
    candles,
    quote: {
      assetCode: symbol,
      price: finalPrice,
      currency: "USD",
      timestamp: finalTimestamp,
      source: finalSource,
      isMarketOpen: finalIsMarketOpen,
      isExtendedHours: finalIsExtendedHours,
      previousClose: finalPreviousClose,
    },
  });
}
