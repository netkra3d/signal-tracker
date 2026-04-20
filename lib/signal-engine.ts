import { IndicatorPoint } from "@/types/candle";
import { round } from "@/lib/utils";

export type GeneratedSignal = {
  signalType: "BUY" | "SELL";
  signalStage: 1 | 2 | 3;
  signalPrice: number;
  stopPrice: number;
  targetPrice: number;
  reasonSummary: string;
  metadata: Record<string, number>;
};

function recentLow(candles: IndicatorPoint[], lookback: number) {
  return Math.min(...candles.slice(-lookback).map((candle) => candle.low));
}

export function generateSignal(candles: IndicatorPoint[]): GeneratedSignal | null {
  if (candles.length < 60) {
    return null;
  }

  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const ema20 = current.ema20 ?? null;
  const ema60 = current.ema60 ?? null;
  const rsi14 = current.rsi14 ?? null;
  const macdHistogram = current.macdHistogram ?? null;
  const volumeSma20 = current.volumeSma20 ?? null;
  const prevMacdHistogram = previous.macdHistogram ?? null;
  const prevRsi14 = previous.rsi14 ?? null;

  if (
    ema20 === null ||
    ema60 === null ||
    rsi14 === null ||
    macdHistogram === null ||
    volumeSma20 === null ||
    prevMacdHistogram === null ||
    prevRsi14 === null
  ) {
    return null;
  }

  const support = recentLow(candles, 20);
  const buyCross = prevMacdHistogram <= 0 && macdHistogram > 0;
  const buyMomentum = macdHistogram > prevMacdHistogram;
  const isBuy =
    current.close > ema20 &&
    ema20 > ema60 &&
    rsi14 >= 45 &&
    rsi14 <= 65 &&
    (buyCross || buyMomentum) &&
    current.volume >= volumeSma20;

  if (isBuy) {
    return {
      signalType: "BUY",
      signalStage: 1,
      signalPrice: round(current.close, 4),
      stopPrice: round(Math.min(current.close * 0.96, support), 4),
      targetPrice: round(current.close * 1.06, 4),
      reasonSummary: "20EMA 상단, RSI 중립 강세, MACD 개선, 거래량 확인",
      metadata: {
        entry1: round(current.close, 4),
        entry2: round(ema20, 4),
        entry3: round(support, 4),
      },
    };
  }

  const isSell = current.close < ema20 || (prevRsi14 >= 70 && rsi14 < prevRsi14) || macdHistogram < prevMacdHistogram;

  if (isSell) {
    return {
      signalType: "SELL",
      signalStage: 1,
      signalPrice: round(current.close, 4),
      stopPrice: round(current.close * 1.02, 4),
      targetPrice: round(current.close * 0.97, 4),
      reasonSummary: "20EMA 이탈 또는 MACD 약화로 매도 후보",
      metadata: {
        exit1: round(current.close * 1.02, 4),
        exit2: round(current.close * 1.04, 4),
        exit3: round(current.close, 4),
      },
    };
  }

  return null;
}
