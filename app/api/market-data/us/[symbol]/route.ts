import { NextResponse } from "next/server";

type CandlePoint = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

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
  previousClose?: number;
  exchangeName?: string;
  currentTradingPeriod?: {
    pre?: YahooChartPeriod;
    regular?: YahooChartPeriod;
    post?: YahooChartPeriod;
  };
};

type YahooChartQuote = {
  open?: Array<number | null>;
  high?: Array<number | null>;
  low?: Array<number | null>;
  close?: Array<number | null>;
  volume?: Array<number | null>;
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

type YahooQuoteSnapshot = {
  price: number;
  timestamp: string;
  isExtendedHours: boolean;
  isMarketOpen: boolean;
  source: string;
  previousClose: number | null;
};

export const dynamic = "force-dynamic";

function parseNumber(value: string | number | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildYahooQuote(result: YahooChartResult | undefined) {
  const meta = result?.meta;
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const closes = quote?.close ?? [];

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
  } satisfies YahooQuoteSnapshot;
}

async function fetchYahooChart(symbol: string, interval: string, range: string, includePrePost: boolean) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(
      interval,
    )}&range=${encodeURIComponent(range)}&includePrePost=${includePrePost ? "true" : "false"}&events=div%2Csplits`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as YahooChartResponse;
  return data.chart?.result?.[0] ?? null;
}

function resampleToFourHourCandles(result: YahooChartResult | null, count: number) {
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const opens = quote?.open ?? [];
  const highs = quote?.high ?? [];
  const lows = quote?.low ?? [];
  const closes = quote?.close ?? [];
  const volumes = quote?.volume ?? [];

  if (timestamps.length === 0) {
    return [] as CandlePoint[];
  }

  const grouped = new Map<number, CandlePoint>();

  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = timestamps[index];
    const open = opens[index];
    const high = highs[index];
    const low = lows[index];
    const close = closes[index];
    const volume = volumes[index];

    if (
      typeof timestamp !== "number" ||
      typeof open !== "number" ||
      typeof high !== "number" ||
      typeof low !== "number" ||
      typeof close !== "number" ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }

    const bucket = Math.floor(timestamp / (60 * 60 * 4)) * (60 * 60 * 4);
    const existing = grouped.get(bucket);

    if (!existing) {
      grouped.set(bucket, {
        time: new Date(bucket * 1000).toISOString(),
        open,
        high,
        low,
        close,
        volume: typeof volume === "number" && Number.isFinite(volume) ? volume : 0,
      });
      continue;
    }

    existing.high = Math.max(existing.high, high);
    existing.low = Math.min(existing.low, low);
    existing.close = close;
    existing.volume += typeof volume === "number" && Number.isFinite(volume) ? volume : 0;
  }

  return Array.from(grouped.values())
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    .slice(-count);
}

async function fetchYahooCandles(symbol: string, count: number) {
  const result = await fetchYahooChart(symbol, "1h", "1y", false);
  if (!result) {
    return [] as CandlePoint[];
  }

  return resampleToFourHourCandles(result, count);
}

async function fetchYahooExtendedQuote(symbol: string) {
  const result = await fetchYahooChart(symbol, "1m", "1d", true);
  return buildYahooQuote(result ?? undefined);
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
    return null;
  }

  const regularData = (await regularResponse.json()) as TwelveQuoteResponse;
  return regularData.status === "error" ? null : regularData;
}

async function fetchTwelveCandles(symbol: string, apiKey: string, count: number) {
  const response = await fetch(
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=4h&outputsize=${count}&order=asc&timezone=America/New_York&apikey=${encodeURIComponent(apiKey)}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as TwelveTimeSeriesResponse;
  if (!data.values || data.status === "error") {
    return null;
  }

  return data.values.map((item) => ({
    time: new Date(item.datetime.replace(" ", "T")).toISOString(),
    open: parseNumber(item.open),
    high: parseNumber(item.high),
    low: parseNumber(item.low),
    close: parseNumber(item.close),
    volume: parseNumber(item.volume),
  }));
}

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: "TWELVE_DATA_API_KEY is missing." }, { status: 503 });
  }

  const { symbol } = await params;
  const url = new URL(request.url);
  const count = Number(url.searchParams.get("count") ?? "200");

  const [twelveCandles, twelveQuote, yahooQuote, yahooCandles] = await Promise.all([
    fetchTwelveCandles(symbol, apiKey, count),
    fetchQuote(symbol, apiKey),
    fetchYahooExtendedQuote(symbol),
    fetchYahooCandles(symbol, count),
  ]);

  const candles = (twelveCandles && twelveCandles.length > 0 ? twelveCandles : yahooCandles).slice(-count);
  if (candles.length === 0 && !yahooQuote && !twelveQuote) {
    return NextResponse.json({ message: "Failed to load US ETF market data." }, { status: 502 });
  }

  const latestTimestamp = twelveQuote?.timestamp
    ? new Date(twelveQuote.timestamp * 1000).toISOString()
    : twelveQuote?.datetime
      ? new Date(twelveQuote.datetime.replace(" ", "T")).toISOString()
      : candles.at(-1)?.time ?? new Date().toISOString();

  const shouldUseYahooQuote =
    yahooQuote &&
    (yahooQuote.isExtendedHours ||
      !twelveQuote ||
      new Date(yahooQuote.timestamp).getTime() > new Date(latestTimestamp).getTime());

  const finalPrice = shouldUseYahooQuote
    ? yahooQuote.price
    : parseNumber(twelveQuote?.close ?? candles.at(-1)?.close);
  const finalTimestamp = shouldUseYahooQuote ? yahooQuote.timestamp : latestTimestamp;
  const finalSource = shouldUseYahooQuote
    ? `${yahooQuote.source}${yahooQuote.isExtendedHours ? ":extended" : ""}`
    : twelveQuote?.exchange
      ? `twelve-data:${twelveQuote.exchange}${twelveQuote.is_extended_hours ? ":extended" : ""}`
      : "yahoo-finance-unofficial:candle-fallback";
  const finalIsMarketOpen = shouldUseYahooQuote ? yahooQuote.isMarketOpen : Boolean(twelveQuote?.is_market_open);
  const finalIsExtendedHours = shouldUseYahooQuote ? yahooQuote.isExtendedHours : Boolean(twelveQuote?.is_extended_hours);
  const finalPreviousClose = shouldUseYahooQuote
    ? yahooQuote.previousClose
    : twelveQuote?.previous_close
      ? parseNumber(twelveQuote.previous_close)
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
