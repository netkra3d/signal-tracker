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

export type MvpAsset = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  currency: "KRW" | "USD";
  marketType: "UPBIT" | "US_STOCK" | "KR_ETF";
  isActive: boolean;
  supportsLiveData: boolean;
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
  trades: LocalTradeRecord[];
  settings: AppSettings;
  customNotes: Record<string, string>;
};

type MarketDataProvider = {
  key: string;
  getCandles: (asset: MvpAsset) => Promise<Candle[]>;
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
};

export const STORAGE_KEYS = {
  trades: "signal-tracker:mvp:trades",
  candles: "signal-tracker:mvp:candles",
  settings: "signal-tracker:mvp:settings",
  customNotes: "signal-tracker:mvp:notes",
  importMeta: "signal-tracker:mvp:import-meta",
  appUnlocked: "signal-tracker:mvp:unlocked",
  fxUsdKrw: "signal-tracker:mvp:fx-usd-krw",
} as const;

export const EXPORT_VERSION = 2;

export const DEFAULT_SETTINGS: AppSettings = {
  defaultFeeRate: 0.05,
  splitBuyRatios: [40, 30, 30],
  splitSellRatios: [50, 30, 20],
  stopLossRate: 4,
  defaultInvestmentAmount: 3_000_000,
  appLockEnabled: false,
};

export const MVP_ASSETS: MvpAsset[] = [
  { id: "asset-usdt-krw", code: "USDT_KRW", name: "업비트 테더", symbol: "KRW-USDT", currency: "KRW", marketType: "UPBIT", isActive: true, supportsLiveData: true },
  { id: "asset-btc-krw", code: "BTC_KRW", name: "업비트 비트코인", symbol: "KRW-BTC", currency: "KRW", marketType: "UPBIT", isActive: true, supportsLiveData: true },
  { id: "asset-voo", code: "VOO", name: "VOO", symbol: "VOO", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: false },
  { id: "asset-qqq", code: "QQQ", name: "QQQ", symbol: "QQQ", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: false },
  { id: "asset-gld", code: "GLD", name: "GLD", symbol: "GLD", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: false },
  { id: "asset-slv", code: "SLV", name: "SLV", symbol: "SLV", currency: "USD", marketType: "US_STOCK", isActive: true, supportsLiveData: false },
  { id: "asset-kodex-usd-futures", code: "KODEX_USD_FUTURES", name: "KODEX 미국달러선물", symbol: "261240", currency: "KRW", marketType: "KR_ETF", isActive: true, supportsLiveData: false },
  { id: "asset-tiger-krx-gold", code: "TIGER_KRX_GOLD", name: "TIGER KRX 금현물", symbol: "411060", currency: "KRW", marketType: "KR_ETF", isActive: true, supportsLiveData: false },
];

function ensureBrowser() {
  return typeof window !== "undefined";
}

function seededValue(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getSeedFromCode(code: string) {
  return code.split("").reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
}

function getBasePrice(asset: MvpAsset) {
  switch (asset.code) {
    case "BTC_KRW":
      return 98_000_000;
    case "USDT_KRW":
      return 1_380;
    case "VOO":
      return 520;
    case "QQQ":
      return 460;
    case "GLD":
      return 240;
    case "SLV":
      return 29;
    case "KODEX_USD_FUTURES":
      return 12_800;
    case "TIGER_KRX_GOLD":
      return 18_900;
    default:
      return 100;
  }
}

function getBaseVolume(asset: MvpAsset) {
  return asset.currency === "KRW" ? 1_000 : 10_000;
}

function createMockCandles(asset: MvpAsset, length = 220): Candle[] {
  const seed = getSeedFromCode(asset.code);
  const start = subHours(new Date(), length - 1);
  const candles: Candle[] = [];
  let lastClose = getBasePrice(asset);

  for (let index = 0; index < length; index += 1) {
    const time = addHours(start, index);
    const wave = Math.sin((index + seed) / 8) * lastClose * 0.01;
    const drift = (seededValue(seed + index * 3) - 0.47) * lastClose * 0.012;
    const close = Math.max(1, lastClose + wave * 0.2 + drift);
    const open = lastClose;
    const high = Math.max(open, close) * (1 + seededValue(seed + index * 11) * 0.01);
    const low = Math.min(open, close) * (1 - seededValue(seed + index * 17) * 0.01);
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

function readStorage<T>(key: string, fallback: T): T {
  if (!ensureBrowser()) {
    return fallback;
  }

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

  window.localStorage.setItem(key, JSON.stringify(value));
}

function getMockProvider(): MarketDataProvider {
  return {
    key: "mock",
    async getCandles(asset) {
      return createMockCandles(asset);
    },
  };
}

function getUpbitProvider(): MarketDataProvider {
  return {
    key: "upbit-live",
    async getCandles(asset) {
      if (asset.marketType !== "UPBIT") {
        return createMockCandles(asset);
      }

      const response = await fetch(`/api/market-data/upbit/${asset.symbol}?count=200`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to fetch live candles for ${asset.code}`);
      }

      const data = (await response.json()) as { candles: Candle[] };
      return data.candles;
    },
  };
}

export function getMarketDataProvider(asset: MvpAsset): MarketDataProvider {
  if (asset.marketType === "UPBIT" && asset.supportsLiveData) {
    return getUpbitProvider();
  }

  return getMockProvider();
}

export const marketDataRepository = {
  async getCandles(assetCode: string) {
    const asset = getMvpAssetByCode(assetCode);
    if (!asset) {
      return [] as Candle[];
    }

    const provider = getMarketDataProvider(asset);
    const candles = await provider.getCandles(asset);
    const candleMap = readStorage<Record<string, Candle[]>>(STORAGE_KEYS.candles, {});
    candleMap[assetCode] = candles;
    writeStorage(STORAGE_KEYS.candles, candleMap);
    return candles;
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
  return MVP_ASSETS.find((asset) => asset.code === code) ?? null;
}

export function getAssetById(assetId: string) {
  return MVP_ASSETS.find((asset) => asset.id === assetId) ?? null;
}

export function getCachedCandles(code: string): Candle[] {
  const asset = getMvpAssetByCode(code);
  if (!asset) {
    return [];
  }

  const candleMap = readStorage<Record<string, Candle[]>>(STORAGE_KEYS.candles, {});
  if (!candleMap[code]) {
    candleMap[code] = createMockCandles(asset);
    writeStorage(STORAGE_KEYS.candles, candleMap);
  }

  return candleMap[code];
}

export async function loadCandlesForAsset(code: string) {
  const asset = getMvpAssetByCode(code);
  if (!asset) {
    return [];
  }

  try {
    return await marketDataRepository.getCandles(code);
  } catch {
    return getCachedCandles(code);
  }
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
    return "관망";
  }

  return signal.signalType === "BUY" ? "매수 후보" : "매도 후보";
}

function createSignalView(
  asset: MvpAsset,
  point: IndicatorPoint,
  generated: ReturnType<typeof generateSignal>,
  index: number
): SignalView {
  return {
    id: `${asset.code}-${point.time}-${generated?.signalType ?? "NONE"}-${index}`,
    assetCode: asset.code,
    assetName: asset.name,
    timestamp: point.time,
    signalType: generated?.signalType ?? "BUY",
    signalStage: generated?.signalStage ?? 1,
    strategyName: "ema-rsi-macd-volume-v1",
    signalPrice: generated?.signalPrice ?? point.close,
    stopPrice: generated?.stopPrice ?? null,
    targetPrice: generated?.targetPrice ?? null,
    reasonSummary:
      generated?.reasonSummary ??
      (generated?.signalType === "BUY"
        ? "매수 후보: EMA 정배열, RSI 중립 강세, 거래량 확인"
        : "매도 후보: EMA 이탈 또는 MACD 둔화"),
    status: "NEW",
  };
}

export function getSignalsFromCandles(assetCode: string, candles: Candle[]) {
  const asset = getMvpAssetByCode(assetCode);
  if (!asset) {
    return [] as SignalView[];
  }

  const indicators = enrichCandles(candles.slice(-200));
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

export function getRecentSignals() {
  return MVP_ASSETS.map((asset) => getSignalsFromCandles(asset.code, getCachedCandles(asset.code)).at(-1))
    .filter(Boolean) as SignalView[];
}

export function readTrades() {
  return storageRepository.readTrades();
}

export function getSettings() {
  return storageRepository.readSettings();
}

export function saveSettings(settings: AppSettings) {
  storageRepository.writeSettings(settings);
}

export function getCustomNotes() {
  return storageRepository.readNotes();
}

export function saveCustomNote(key: string, note: string) {
  const current = storageRepository.readNotes();
  current[key] = note;
  storageRepository.writeNotes(current);
}

export function validateTradeInput(input: TradeFormInput) {
  const asset = getAssetById(input.assetId);
  if (!asset) {
    return { ok: false as const, message: "자산을 찾을 수 없습니다." };
  }

  if (input.quantity <= 0 || input.price <= 0) {
    return { ok: false as const, message: "수량과 가격은 0보다 커야 합니다." };
  }

  if (input.fee !== undefined && input.fee < 0) {
    return { ok: false as const, message: "수수료는 음수가 될 수 없습니다." };
  }

  if (input.side === "SELL") {
    const position = getPositionByAssetId(input.assetId);
    if (!position || position.quantity <= 0) {
      return { ok: false as const, message: "보유 수량이 없어 매도할 수 없습니다." };
    }

    if (input.quantity > position.quantity) {
      return { ok: false as const, message: "보유 수량보다 많이 매도할 수 없습니다." };
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
    throw new Error("자산을 찾을 수 없습니다.");
  }

  const fx = await getUsdKrwRate();
  const exchangeRate = asset.currency === "USD" ? fx.rate : 1;
  const trades = readTrades();
  const assetTrades = trades
    .filter((trade) => trade.assetId === input.assetId)
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
    id: `${input.assetId}-${Date.now()}`,
    assetId: input.assetId,
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
  const candles = getCachedCandles(asset.code);
  const lastPrice = candles.at(-1)?.close ?? 0;
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

export async function getAssetDetail(code: string) {
  const asset = getMvpAssetByCode(code);
  if (!asset) {
    return null;
  }

  const candles = await loadCandlesForAsset(code);
  const indicators = enrichCandles(candles);
  const signals = getSignalsFromCandles(code, candles);
  const position = getPositions().find((item) => item.asset.code === code) ?? null;

  return { asset, candles, indicators, signals, position };
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
    trades: readTrades(),
    settings: getSettings(),
    customNotes: getCustomNotes(),
  };
}

export function importLocalData(payload: ExportPayload) {
  if (payload.version > EXPORT_VERSION) {
    throw new Error("지원하지 않는 백업 파일 버전입니다.");
  }

  if (!Array.isArray(payload.trades)) {
    throw new Error("거래 데이터 형식이 올바르지 않습니다.");
  }

  const migratedTrades = payload.trades.map((trade) => {
    if ("exchangeRate" in trade) {
      return trade as LocalTradeRecord;
    }

    const legacy = trade as LocalTradeRecord;
    const asset = getAssetById(legacy.assetId);
    const exchangeRate = asset?.currency === "USD" ? 1_350 : 1;

    return {
      ...legacy,
      exchangeRate,
      krwAmount: convertToKrw(legacy.amount, asset?.currency ?? "KRW", exchangeRate),
      krwFee: convertToKrw(legacy.fee, asset?.currency ?? "KRW", exchangeRate),
      krwRealizedPnl: convertToKrw(legacy.realizedPnl, asset?.currency ?? "KRW", exchangeRate),
      krwCumulativePnl: convertToKrw(legacy.cumulativePnl, asset?.currency ?? "KRW", exchangeRate),
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
