"use client";

import { addHours, subHours } from "date-fns";
import { calculateAnalytics } from "@/lib/analytics";
import { enrichCandles } from "@/lib/indicators";
import { calculateSellPnl, calculateTradeAmount, reduceTradesToPosition } from "@/lib/pnl";
import { generateSignal } from "@/lib/signal-engine";
import { round } from "@/lib/utils";
import { Candle, IndicatorPoint } from "@/types/candle";
import { SignalView } from "@/types/signal";
import { PositionSnapshot, TradeFormInput } from "@/types/trade";

export const DEFAULT_TIMEFRAME = "240m" as const;
export const DEFAULT_TIMEFRAME_LABEL = "240\uBD84\uBD09";
export const CANDLE_LIMIT = 200;
const DEFAULT_TIMEFRAME_HOURS = 4;

const LEGACY_GOLD_ASSET_ID = "asset-tiger-krx-gold";
const CURRENT_GOLD_ASSET_ID = "asset-ace-krx-gold";
const LEGACY_GOLD_CODE = "TIGER_KRX_GOLD";
const CURRENT_GOLD_CODE = "ACE_KRX_GOLD";

export type Timeframe = typeof DEFAULT_TIMEFRAME;

export type MvpAsset = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  currency: "KRW" | "USD";
  marketType: "UPBIT" | "US_STOCK";
  isActive: boolean;
  supportsLiveData: boolean;
  provider: "upbit" | "twelve-data";
};

export type QuoteSnapshot = {
  assetCode: string;
  price: number;
  currency: "KRW" | "USD";
  timestamp: string;
  source: string;
  isMarketOpen: boolean;
  isExtendedHours?: boolean;
  isStale?: boolean;
  previousClose?: number | null;
};

export type DashboardSignalView = SignalView & {
  entryReferencePrice: number;
  divergencePercent: number;
  isDisplayable: true;
};

export type MarketDataSnapshot = {
  assetCode: string;
  timeframe: Timeframe;
  candles: Candle[];
  quote: QuoteSnapshot | null;
};

export type LocalTradeRecord = {
  id: string;
  assetId: string;
  executedAt: string;
  side: "BUY" | "SELL";
  stage: "ONE" | "TWO" | "THREE" | "FULL";
  quantity: number;
  price: number;
  amount: number;
  fee: number;
  realizedPnl: number;
  realizedReturn: number;
  cumulativePnl: number;
  exchangeRate: number;
  krwAmount: number;
  krwFee: number;
  krwRealizedPnl: number;
  krwCumulativePnl: number;
  memo?: string;
  signalId?: string;
};

export type AppSettings = {
  defaultFeeRate: number;
  splitBuyRatios: [number, number, number];
  splitSellRatios: [number, number, number];
  stopLossRate: number;
  defaultInvestmentAmount: number;
  appLockEnabled: boolean;
};

export type ImportMeta = {
  lastImportedAt: string | null;
  version: number;
};

export type FxRateSnapshot = {
  base: "USD";
  quote: "KRW";
  rate: number;
  fetchedAt: string;
};

export type ExportPayload = {
  version: number;
  exportedAt: string;
  defaultTimeframe: Timeframe;
  trades: LocalTradeRecord[];
  settings: AppSettings;
  customNotes: Record<string, string>;
};

type PositionRow = {
  asset: MvpAsset;
  quantity: number;
  avgEntryPrice: number;
  totalCost: number;
  unrealizedPnl: number;
  realizedPnlTotal: number;
  status: PositionSnapshot["status"];
  lastPrice: number;
  quote: QuoteSnapshot | null;
};

type ProviderResponse = {
  candles: Candle[];
  quote: QuoteSnapshot | null;
  timeframe?: string;
};

type MarketDataProvider = {
  key: string;
  getSnapshot: (asset: MvpAsset, forceRefresh?: boolean) => Promise<MarketDataSnapshot>;
};

export const STORAGE_KEYS = {
  trades: "signal-tracker:mvp:trades",
  candles: `signal-tracker:mvp:candles:${DEFAULT_TIMEFRAME}`,
  quotes: "signal-tracker:mvp:quotes",
  settings: "signal-tracker:mvp:settings",
  customNotes: "signal-tracker:mvp:notes",
  importMeta: "signal-tracker:mvp:import-meta",
  appUnlocked: "signal-tracker:mvp:unlocked",
  fxUsdKrw: "signal-tracker:mvp:fx-usd-krw",
} as const;

const LEGACY_STORAGE_KEYS = {
  candles60m: "signal-tracker:mvp:candles",
} as const;

export const EXPORT_VERSION = 3;

export const DEFAULT_SETTINGS: AppSettings = {
  defaultFeeRate: 0.05,
  splitBuyRatios: [40, 30, 30],
  splitSellRatios: [50, 30, 20],
  stopLossRate: 4,
  defaultInvestmentAmount: 3_000_000,
  appLockEnabled: false,
};

export const MVP_ASSETS: MvpAsset[] = [
  { id: "asset-voo", code: "VOO", name: "VOO", symbol: "VOO", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-qqq", code: "QQQ", name: "QQQ", symbol: "QQQ", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-dia", code: "DIA", name: "DIA", symbol: "DIA", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-iwm", code: "IWM", name: "IWM", symbol: "IWM", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-xlk", code: "XLK", name: "XLK", symbol: "XLK", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-xlf", code: "XLF", name: "XLF", symbol: "XLF", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-xli", code: "XLI", name: "XLI", symbol: "XLI", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-xlv", code: "XLV", name: "XLV", symbol: "XLV", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-xle", code: "XLE", name: "XLE", symbol: "XLE", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-xly", code: "XLY", name: "XLY", symbol: "XLY", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-xlp", code: "XLP", name: "XLP", symbol: "XLP", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-xlu", code: "XLU", name: "XLU", symbol: "XLU", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-xlc", code: "XLC", name: "XLC", symbol: "XLC", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-xlb", code: "XLB", name: "XLB", symbol: "XLB", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-xlre", code: "XLRE", name: "XLRE", symbol: "XLRE", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-smh", code: "SMH", name: "SMH", symbol: "SMH", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-xbi", code: "XBI", name: "XBI", symbol: "XBI", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-gld", code: "GLD", name: "GLD", symbol: "GLD", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-slv", code: "SLV", name: "SLV", symbol: "SLV", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  { id: "asset-tlt", code: "TLT", name: "TLT", symbol: "TLT", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: true, provider: "twelve-data" },
  {
    id: "asset-usdt-krw",
    code: "USDT_KRW",
    name: "\uC5C5\uBE44\uD2B8 \uD14C\uB354",
    symbol: "KRW-USDT",
    currency: "KRW",
    marketType: "UPBIT",
    isActive: true,
    supportsLiveData: true,
    provider: "upbit",
  },
  {
    id: "asset-btc-krw",
    code: "BTC_KRW",
    name: "\uC5C5\uBE44\uD2B8 \uBE44\uD2B8\uCF54\uC778",
    symbol: "KRW-BTC",
    currency: "KRW",
    marketType: "UPBIT",
    isActive: true,
    supportsLiveData: true,
    provider: "upbit",
  },
  {
    id: "asset-eth-krw",
    code: "ETH_KRW",
    name: "업비트 이더리움",
    symbol: "KRW-ETH",
    currency: "KRW",
    marketType: "UPBIT",
    isActive: true,
    supportsLiveData: true,
    provider: "upbit",
  },
  {
    id: "asset-sol-krw",
    code: "SOL_KRW",
    name: "업비트 솔라나",
    symbol: "KRW-SOL",
    currency: "KRW",
    marketType: "UPBIT",
    isActive: true,
    supportsLiveData: true,
    provider: "upbit",
  },
  {
    id: "asset-xrp-krw",
    code: "XRP_KRW",
    name: "업비트 XRP",
    symbol: "KRW-XRP",
    currency: "KRW",
    marketType: "UPBIT",
    isActive: true,
    supportsLiveData: true,
    provider: "upbit",
  },
];

function ensureBrowser() {
  return typeof window !== "undefined";
}

let storageMigrated = false;

function seededValue(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function normalizeAssetId(assetId: string) {
  return assetId === LEGACY_GOLD_ASSET_ID ? CURRENT_GOLD_ASSET_ID : assetId;
}

function normalizeAssetCode(code: string) {
  return code === LEGACY_GOLD_CODE ? CURRENT_GOLD_CODE : code;
}

function getSeedFromCode(code: string) {
  return normalizeAssetCode(code)
    .split("")
    .reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
}

function getBasePrice(asset: MvpAsset) {
  switch (asset.code) {
    case "BTC_KRW":
      return 111_000_000;
    case "USDT_KRW":
      return 1_480;
    case "ETH_KRW":
      return 5_300_000;
    case "SOL_KRW":
      return 235_000;
    case "XRP_KRW":
      return 3_000;
    case "VOO":
      return 650;
    case "QQQ":
      return 645;
    case "DIA":
      return 425;
    case "GLD":
      return 445;
    case "SLV":
      return 74;
    case "IWM":
      return 275;
    case "SMH":
      return 460;
    case "XLK":
      return 154;
    case "XLF":
      return 52;
    case "XLI":
      return 145;
    case "XLV":
      return 138;
    case "XLE":
      return 96;
    case "XLY":
      return 215;
    case "XLP":
      return 82;
    case "XLU":
      return 78;
    case "XLC":
      return 97;
    case "XLB":
      return 92;
    case "XLRE":
      return 42;
    case "XBI":
      return 92;
    case "TLT":
      return 88;
    default:
      return 100;
  }
}

function getBaseVolume(asset: MvpAsset) {
  return asset.currency === "KRW" ? 1_000 : 10_000;
}

function createMockCandles(asset: MvpAsset, length = CANDLE_LIMIT): Candle[] {
  const seed = getSeedFromCode(asset.code);
  const start = subHours(new Date(), (length - 1) * DEFAULT_TIMEFRAME_HOURS);
  const candles: Candle[] = [];
  let lastClose = getBasePrice(asset);

  for (let index = 0; index < length; index += 1) {
    const time = addHours(start, index * DEFAULT_TIMEFRAME_HOURS);
    const wave = Math.sin((index + seed) / 6) * lastClose * 0.018;
    const drift = (seededValue(seed + index * 3) - 0.47) * lastClose * 0.016;
    const close = Math.max(1, lastClose + wave * 0.25 + drift);
    const open = lastClose;
    const high = Math.max(open, close) * (1 + seededValue(seed + index * 11) * 0.012);
    const low = Math.min(open, close) * (1 - seededValue(seed + index * 17) * 0.012);
    const volume = getBaseVolume(asset) * (0.75 + seededValue(seed + index * 5) * 0.8);

    candles.push({
      time: time.toISOString(),
      open: Number(open.toFixed(asset.currency === "KRW" ? 0 : 2)),
      high: Number(high.toFixed(asset.currency === "KRW" ? 0 : 2)),
      low: Number(low.toFixed(asset.currency === "KRW" ? 0 : 2)),
      close: Number(close.toFixed(asset.currency === "KRW" ? 0 : 2)),
      volume: Number(volume.toFixed(2)),
    });

    lastClose = close;
  }

  return candles;
}

function createMockQuote(asset: MvpAsset, candles: Candle[]): QuoteSnapshot {
  const last = candles.at(-1);
  return {
    assetCode: asset.code,
    price: last?.close ?? getBasePrice(asset),
    currency: asset.currency,
    timestamp: last?.time ?? new Date().toISOString(),
    source: "mock",
    isMarketOpen: false,
    isStale: true,
    previousClose: candles.at(-2)?.close ?? null,
  };
}

function runStorageMigrations() {
  if (!ensureBrowser() || storageMigrated) {
    return;
  }

  const tradesRaw = window.localStorage.getItem(STORAGE_KEYS.trades);
  if (tradesRaw) {
    try {
      const parsed = JSON.parse(tradesRaw) as LocalTradeRecord[];
      const migrated = parsed.map((trade) => ({ ...trade, assetId: normalizeAssetId(trade.assetId) }));
      window.localStorage.setItem(STORAGE_KEYS.trades, JSON.stringify(migrated));
    } catch {
      // noop
    }
  }

  const notesRaw = window.localStorage.getItem(STORAGE_KEYS.customNotes);
  if (notesRaw) {
    try {
      const parsed = JSON.parse(notesRaw) as Record<string, string>;
      if (parsed[LEGACY_GOLD_CODE] && !parsed[CURRENT_GOLD_CODE]) {
        parsed[CURRENT_GOLD_CODE] = parsed[LEGACY_GOLD_CODE];
      }
      delete parsed[LEGACY_GOLD_CODE];
      window.localStorage.setItem(STORAGE_KEYS.customNotes, JSON.stringify(parsed));
    } catch {
      // noop
    }
  }

  const legacyCandles = window.localStorage.getItem(LEGACY_STORAGE_KEYS.candles60m);
  if (legacyCandles && !window.localStorage.getItem(STORAGE_KEYS.candles)) {
    try {
      const parsed = JSON.parse(legacyCandles) as Record<string, Candle[]>;
      const migrated: Record<string, Candle[]> = {};
      for (const [key, value] of Object.entries(parsed)) {
        migrated[normalizeAssetCode(key)] = value;
      }
      window.localStorage.setItem(STORAGE_KEYS.candles, JSON.stringify(migrated));
    } catch {
      // noop
    }
  }

  storageMigrated = true;
}

function readStorage<T>(key: string, fallback: T): T {
  if (!ensureBrowser()) {
    return fallback;
  }

  runStorageMigrations();
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (!ensureBrowser()) {
    return;
  }

  runStorageMigrations();
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeQuote(asset: MvpAsset, quote: QuoteSnapshot | null, candles: Candle[]) {
  if (quote) {
    return {
      ...quote,
      assetCode: normalizeAssetCode(quote.assetCode),
      currency: asset.currency,
    };
  }

  return createMockQuote(asset, candles);
}

async function fetchProviderResponse(url: string, forceRefresh = false) {
  const nextUrl = forceRefresh ? `${url}${url.includes("?") ? "&" : "?"}refresh=${Date.now()}` : url;
  const response = await fetch(nextUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${nextUrl}`);
  }

  return (await response.json()) as ProviderResponse;
}

function buildSnapshot(asset: MvpAsset, data: ProviderResponse): MarketDataSnapshot {
  const candles = data.candles?.length ? data.candles : createMockCandles(asset);

  return {
    assetCode: asset.code,
    timeframe: DEFAULT_TIMEFRAME,
    candles,
    quote: normalizeQuote(asset, data.quote, candles),
  };
}

function getMockProvider(): MarketDataProvider {
  return {
    key: "mock",
    async getSnapshot(asset) {
      const candles = createMockCandles(asset);
      return {
        assetCode: asset.code,
        timeframe: DEFAULT_TIMEFRAME,
        candles,
        quote: createMockQuote(asset, candles),
      };
    },
  };
}

function getUpbitProvider(): MarketDataProvider {
  return {
    key: "upbit-live",
    async getSnapshot(asset, forceRefresh = false) {
      const data = await fetchProviderResponse(`/api/market-data/upbit/${asset.symbol}?count=${CANDLE_LIMIT}`, forceRefresh);
      return buildSnapshot(asset, data);
    },
  };
}

function getUsProvider(): MarketDataProvider {
  return {
    key: "us-live",
    async getSnapshot(asset, forceRefresh = false) {
      const data = await fetchProviderResponse(`/api/market-data/us/${asset.symbol}?count=${CANDLE_LIMIT}`, forceRefresh);
      return buildSnapshot(asset, data);
    },
  };
}

export function getMarketDataProvider(asset: MvpAsset): MarketDataProvider {
  switch (asset.provider) {
    case "upbit":
      return getUpbitProvider();
    case "twelve-data":
      return getUsProvider();
    default:
      return getMockProvider();
  }
}

function readCandlesMap() {
  return readStorage<Record<string, Candle[]>>(STORAGE_KEYS.candles, {});
}

function writeCandlesMap(value: Record<string, Candle[]>) {
  writeStorage(STORAGE_KEYS.candles, value);
}

function readQuotesMap() {
  return readStorage<Record<string, QuoteSnapshot>>(STORAGE_KEYS.quotes, {});
}

function writeQuotesMap(value: Record<string, QuoteSnapshot>) {
  writeStorage(STORAGE_KEYS.quotes, value);
}

export const marketDataRepository = {
  async getSnapshot(assetCode: string, forceRefresh = false) {
    const asset = getMvpAssetByCode(assetCode);
    if (!asset) {
      return null;
    }

    const provider = getMarketDataProvider(asset);
    const snapshot = await provider.getSnapshot(asset, forceRefresh);

    const candleMap = readCandlesMap();
    candleMap[asset.code] = snapshot.candles;
    writeCandlesMap(candleMap);

    if (snapshot.quote) {
      const quoteMap = readQuotesMap();
      quoteMap[asset.code] = snapshot.quote;
      writeQuotesMap(quoteMap);
    }

    return snapshot;
  },
};

export const storageRepository = {
  readTrades() {
    return readStorage<LocalTradeRecord[]>(STORAGE_KEYS.trades, []);
  },
  writeTrades(trades: LocalTradeRecord[]) {
    writeStorage(STORAGE_KEYS.trades, trades);
  },
  readSettings() {
    return { ...DEFAULT_SETTINGS, ...readStorage<AppSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS) };
  },
  writeSettings(settings: AppSettings) {
    writeStorage(STORAGE_KEYS.settings, settings);
  },
  readNotes() {
    return readStorage<Record<string, string>>(STORAGE_KEYS.customNotes, {});
  },
  writeNotes(notes: Record<string, string>) {
    writeStorage(STORAGE_KEYS.customNotes, notes);
  },
  readImportMeta() {
    return readStorage<ImportMeta>(STORAGE_KEYS.importMeta, { lastImportedAt: null, version: EXPORT_VERSION });
  },
  writeImportMeta(meta: ImportMeta) {
    writeStorage(STORAGE_KEYS.importMeta, meta);
  },
  readFxUsdKrw() {
    return readStorage<FxRateSnapshot | null>(STORAGE_KEYS.fxUsdKrw, null);
  },
  writeFxUsdKrw(snapshot: FxRateSnapshot) {
    writeStorage(STORAGE_KEYS.fxUsdKrw, snapshot);
  },
};

export function listMvpAssets() {
  return MVP_ASSETS;
}

export function getMvpAssetByCode(code: string) {
  const normalized = normalizeAssetCode(code);
  return MVP_ASSETS.find((asset) => asset.code === normalized) ?? null;
}

export function getAssetById(assetId: string) {
  const normalized = normalizeAssetId(assetId);
  return MVP_ASSETS.find((asset) => asset.id === normalized) ?? null;
}

export function getCachedCandles(code: string): Candle[] {
  const asset = getMvpAssetByCode(code);
  if (!asset) {
    return [];
  }

  const candleMap = readCandlesMap();
  if (!candleMap[asset.code]) {
    candleMap[asset.code] = createMockCandles(asset);
    writeCandlesMap(candleMap);
  }

  return candleMap[asset.code];
}

export function getCachedQuote(code: string) {
  const asset = getMvpAssetByCode(code);
  if (!asset) {
    return null;
  }

  const quoteMap = readQuotesMap();
  if (quoteMap[asset.code]) {
    return quoteMap[asset.code];
  }

  const candles = getCachedCandles(asset.code);
  const fallback = createMockQuote(asset, candles);
  quoteMap[asset.code] = fallback;
  writeQuotesMap(quoteMap);
  return fallback;
}

export async function loadMarketDataForAsset(code: string, forceRefresh = false) {
  const asset = getMvpAssetByCode(code);
  if (!asset) {
    return null;
  }

  try {
    return await marketDataRepository.getSnapshot(asset.code, forceRefresh);
  } catch {
    const candles = getCachedCandles(asset.code);
    const quote = getCachedQuote(asset.code);

    return {
      assetCode: asset.code,
      timeframe: DEFAULT_TIMEFRAME,
      candles,
      quote: quote ? { ...quote, isStale: true } : createMockQuote(asset, candles),
    } satisfies MarketDataSnapshot;
  }
}

export async function loadCandlesForAsset(code: string) {
  const snapshot = await loadMarketDataForAsset(code);
  return snapshot?.candles ?? [];
}

export async function loadQuoteForAsset(code: string, forceRefresh = false) {
  const snapshot = await loadMarketDataForAsset(code, forceRefresh);
  return snapshot?.quote ?? null;
}

export async function getUsdKrwRate(forceRefresh = false) {
  const cached = storageRepository.readFxUsdKrw();
  const now = Date.now();
  const cacheAge = cached ? now - new Date(cached.fetchedAt).getTime() : Number.POSITIVE_INFINITY;

  if (!forceRefresh && cached && cacheAge < 1000 * 60 * 60) {
    return cached;
  }

  try {
    const response = await fetch("/api/fx/usd-krw", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("FX fetch failed");
    }

    const snapshot = (await response.json()) as FxRateSnapshot;
    storageRepository.writeFxUsdKrw(snapshot);
    return snapshot;
  } catch {
    if (cached) {
      return cached;
    }

    const fallback: FxRateSnapshot = {
      base: "USD",
      quote: "KRW",
      rate: 1_350,
      fetchedAt: new Date().toISOString(),
    };
    storageRepository.writeFxUsdKrw(fallback);
    return fallback;
  }
}

export function getSignalLabel(signal: SignalView | null) {
  if (!signal) {
    return "\uAD00\uB9DD";
  }

  return signal.signalType === "BUY" ? "\uB9E4\uC218 \uD6C4\uBCF4" : "\uB9E4\uB3C4 \uD6C4\uBCF4";
}

function createSignalView(asset: MvpAsset, point: IndicatorPoint, generated: ReturnType<typeof generateSignal>, index: number): SignalView {
  return {
    id: `${asset.code}-${point.time}-${generated?.signalType ?? "NONE"}-${index}`,
    assetCode: asset.code,
    assetName: asset.name,
    timestamp: point.time,
    signalType: generated?.signalType ?? "BUY",
    signalStage: generated?.signalStage ?? 1,
    strategyName: "ema-rsi-macd-volume-240m-v1",
    signalPrice: generated?.signalPrice ?? point.close,
    stopPrice: generated?.stopPrice ?? null,
    targetPrice: generated?.targetPrice ?? null,
    reasonSummary:
      generated?.reasonSummary ??
      (generated?.signalType === "BUY"
        ? "\u0032\u0034\u0030\uBD84\uBD09 \uCD94\uC138 \uD655\uC778 \uD6C4 \uBD84\uD560 \uC9C4\uC785 \uD6C4\uBCF4"
        : "\u0032\u0034\u0030\uBD84\uBD09 \uCD94\uC138 \uC57D\uD654 \uB610\uB294 \uC774\uD0C8 \uC2E0\uD638"),
    status: "NEW",
  };
}

export function getSignalsFromCandles(assetCode: string, candles: Candle[]) {
  const asset = getMvpAssetByCode(assetCode);
  if (!asset) {
    return [] as SignalView[];
  }

  const indicators = enrichCandles(candles.slice(-CANDLE_LIMIT));
  const signals: SignalView[] = [];

  for (let index = 60; index < indicators.length; index += 1) {
    const generated = generateSignal(indicators.slice(0, index + 1));
    if (!generated) {
      continue;
    }

    const point = indicators[index];
    const previous = signals[signals.length - 1];
    if (previous && previous.timestamp === point.time && previous.signalType === generated.signalType) {
      continue;
    }

    signals.push(createSignalView(asset, point, generated, index));
  }

  return signals.slice(-12);
}

export function isActionableBuySignal(signal: SignalView, quote: QuoteSnapshot | null, thresholdPercent = 3) {
  return Boolean(getDisplayableDashboardSignal(signal, quote, thresholdPercent) && signal.signalType === "BUY");
}

export function getDisplayableDashboardSignal(
  signal: SignalView | null,
  quote: QuoteSnapshot | null,
  thresholdPercent = 3,
): DashboardSignalView | null {
  if (!signal || !quote || signal.signalPrice <= 0) {
    return null;
  }

  const divergencePercent = Math.abs((quote.price - signal.signalPrice) / signal.signalPrice) * 100;
  if (divergencePercent > thresholdPercent) {
    return null;
  }

  return {
    ...signal,
    entryReferencePrice: quote.price,
    divergencePercent,
    isDisplayable: true,
  };
}

export function getRecentSignals() {
  return MVP_ASSETS.map((asset) => getSignalsFromCandles(asset.code, getCachedCandles(asset.code)).at(-1))
    .filter(Boolean) as SignalView[];
}

export function readTrades() {
  return storageRepository.readTrades().map((trade) => ({
    ...trade,
    assetId: normalizeAssetId(trade.assetId),
  }));
}

export function getSettings() {
  return storageRepository.readSettings();
}

export function saveSettings(settings: AppSettings) {
  storageRepository.writeSettings(settings);
}

export function getCustomNotes() {
  const notes = storageRepository.readNotes();
  if (notes[LEGACY_GOLD_CODE] && !notes[CURRENT_GOLD_CODE]) {
    notes[CURRENT_GOLD_CODE] = notes[LEGACY_GOLD_CODE];
  }
  delete notes[LEGACY_GOLD_CODE];
  return notes;
}

export function saveCustomNote(key: string, note: string) {
  const current = storageRepository.readNotes();
  current[normalizeAssetCode(key)] = note;
  storageRepository.writeNotes(current);
}

export function validateTradeInput(input: TradeFormInput) {
  const asset = getAssetById(input.assetId);
  if (!asset) {
    return { ok: false as const, message: "Asset not found." };
  }

  if (input.quantity <= 0 || input.price <= 0) {
    return { ok: false as const, message: "Quantity and price must be greater than zero." };
  }

  if (input.fee !== undefined && input.fee < 0) {
    return { ok: false as const, message: "Fee cannot be negative." };
  }

  if (input.side === "SELL") {
    const position = getPositionByAssetId(input.assetId);
    if (!position || position.quantity <= 0) {
      return { ok: false as const, message: "No position available to sell." };
    }

    if (input.quantity > position.quantity) {
      return { ok: false as const, message: "Cannot sell more than current position size." };
    }
  }

  return { ok: true as const };
}

function convertToKrw(value: number, currency: "KRW" | "USD", exchangeRate: number) {
  if (currency === "KRW") {
    return round(value, 0);
  }

  return round(value * exchangeRate, 0);
}

export async function saveTrade(input: TradeFormInput) {
  const validation = validateTradeInput(input);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const asset = getAssetById(input.assetId);
  if (!asset) {
    throw new Error("Asset not found.");
  }

  const fx = await getUsdKrwRate();
  const exchangeRate = asset.currency === "USD" ? fx.rate : 1;
  const trades = readTrades();
  const assetTrades = trades
    .filter((trade) => trade.assetId === normalizeAssetId(input.assetId))
    .sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime());

  const position = reduceTradesToPosition(assetTrades);
  const fee = input.fee ?? 0;
  const amount = calculateTradeAmount(input.quantity, input.price);
  let realizedPnl = 0;
  let realizedReturn = 0;

  if (input.side === "SELL") {
    const sellMetrics = calculateSellPnl(position.avgEntryPrice, input.quantity, input.price, fee);
    realizedPnl = sellMetrics.realizedPnl;
    realizedReturn = sellMetrics.realizedReturn;
  }

  const krwAmount = convertToKrw(amount, asset.currency, exchangeRate);
  const krwFee = convertToKrw(fee, asset.currency, exchangeRate);
  const krwRealizedPnl = convertToKrw(realizedPnl, asset.currency, exchangeRate);
  const krwCumulativePnl =
    round(trades.reduce((sum, trade) => sum + (trade.krwRealizedPnl ?? trade.realizedPnl), 0) + krwRealizedPnl, 0);
  const cumulativePnl = trades.reduce((sum, trade) => sum + trade.realizedPnl, 0) + realizedPnl;

  const record: LocalTradeRecord = {
    id: `${normalizeAssetId(input.assetId)}-${Date.now()}`,
    assetId: normalizeAssetId(input.assetId),
    executedAt: input.executedAt,
    side: input.side,
    stage: input.stage,
    quantity: input.quantity,
    price: input.price,
    amount,
    fee,
    realizedPnl,
    realizedReturn,
    cumulativePnl,
    exchangeRate,
    krwAmount,
    krwFee,
    krwRealizedPnl,
    krwCumulativePnl,
    memo: input.memo,
    signalId: input.signalId,
  };

  const nextTrades = [...trades, record].sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
  storageRepository.writeTrades(nextTrades);
  return record;
}

export function getPositionByAssetId(assetId: string): PositionRow | null {
  const asset = getAssetById(assetId);
  if (!asset) {
    return null;
  }

  const trades = readTrades()
    .filter((trade) => trade.assetId === asset.id)
    .sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime());
  const quote = getCachedQuote(asset.code);
  const lastPrice = quote?.price ?? getCachedCandles(asset.code).at(-1)?.close ?? 0;
  const position = reduceTradesToPosition(trades, lastPrice);

  return {
    asset,
    quantity: position.quantity,
    avgEntryPrice: position.avgEntryPrice,
    totalCost: position.totalCost,
    unrealizedPnl: position.unrealizedPnl,
    realizedPnlTotal: position.realizedPnlTotal,
    status: position.status,
    lastPrice,
    quote,
  };
}

export function getPositions() {
  return MVP_ASSETS.map((asset) => getPositionByAssetId(asset.id))
    .filter(Boolean)
    .filter((item) => item!.quantity > 0 || item!.realizedPnlTotal !== 0) as PositionRow[];
}

export function getAnalyticsSnapshot() {
  const trades = readTrades();
  const sellTrades = trades
    .filter((trade) => trade.side === "SELL")
    .map((trade) => ({
      assetCode: getAssetById(trade.assetId)?.code ?? "UNKNOWN",
      executedAt: new Date(trade.executedAt),
      realizedPnl: trade.krwRealizedPnl ?? trade.realizedPnl,
      realizedReturn: trade.realizedReturn,
    }));

  return calculateAnalytics(sellTrades);
}

export async function getAssetDetail(code: string, forceRefresh = false) {
  const asset = getMvpAssetByCode(code);
  if (!asset) {
    return null;
  }

  const snapshot = await loadMarketDataForAsset(code, forceRefresh);
  const candles = snapshot?.candles ?? [];
  const quote = snapshot?.quote ?? null;
  const indicators = enrichCandles(candles);
  const signals = getSignalsFromCandles(code, candles);
  const position = getPositions().find((item) => item.asset.code === code) ?? null;

  return { asset, candles, indicators, signals, position, quote };
}

export function calculateStagePlan(price: number, settings: AppSettings, ema20?: number | null, support?: number | null) {
  const entry1 = price;
  const entry2 = ema20 ?? price * 0.99;
  const entry3 = support ?? price * 0.97;
  const averagePrice =
    (entry1 * settings.splitBuyRatios[0] + entry2 * settings.splitBuyRatios[1] + entry3 * settings.splitBuyRatios[2]) /
    (settings.splitBuyRatios[0] + settings.splitBuyRatios[1] + settings.splitBuyRatios[2]);

  const stopLossPrice = averagePrice * (1 - settings.stopLossRate / 100);
  const takeProfit1 = averagePrice * 1.03;
  const takeProfit2 = averagePrice * 1.06;

  return {
    entry1,
    entry2,
    entry3,
    averagePrice,
    stopLossPrice,
    takeProfit1,
    takeProfit2,
  };
}

export function exportLocalData(): ExportPayload {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    defaultTimeframe: DEFAULT_TIMEFRAME,
    trades: readTrades(),
    settings: getSettings(),
    customNotes: getCustomNotes(),
  };
}

export function importLocalData(payload: ExportPayload) {
  if (payload.version > EXPORT_VERSION) {
    throw new Error("Unsupported backup version.");
  }

  if (!Array.isArray(payload.trades)) {
    throw new Error("Invalid trades payload.");
  }

  const migratedTrades = payload.trades.map((trade) => {
    const asset = getAssetById(normalizeAssetId(trade.assetId));
    const exchangeRate = "exchangeRate" in trade ? trade.exchangeRate : asset?.currency === "USD" ? 1_350 : 1;
    const normalizedTrade = {
      ...trade,
      assetId: normalizeAssetId(trade.assetId),
    } as LocalTradeRecord;

    return {
      ...normalizedTrade,
      exchangeRate,
      krwAmount: convertToKrw(normalizedTrade.amount, asset?.currency ?? "KRW", exchangeRate),
      krwFee: convertToKrw(normalizedTrade.fee, asset?.currency ?? "KRW", exchangeRate),
      krwRealizedPnl: convertToKrw(normalizedTrade.realizedPnl, asset?.currency ?? "KRW", exchangeRate),
      krwCumulativePnl: convertToKrw(normalizedTrade.cumulativePnl, asset?.currency ?? "KRW", exchangeRate),
    };
  });

  storageRepository.writeTrades(migratedTrades);
  storageRepository.writeSettings({ ...DEFAULT_SETTINGS, ...payload.settings });
  storageRepository.writeNotes(payload.customNotes ?? {});
  storageRepository.writeImportMeta({
    version: EXPORT_VERSION,
    lastImportedAt: new Date().toISOString(),
  });
}

export function getAppUnlocked() {
  return readStorage<boolean>(STORAGE_KEYS.appUnlocked, false);
}

export function setAppUnlocked(value: boolean) {
  writeStorage(STORAGE_KEYS.appUnlocked, value);
}
