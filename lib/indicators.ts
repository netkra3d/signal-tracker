import { Candle, IndicatorPoint } from "@/types/candle";
import { round } from "@/lib/utils";

function calculateEma(values: number[], period: number) {
  const multiplier = 2 / (period + 1);
  const result: Array<number | null> = Array(values.length).fill(null);

  let previous: number | null = null;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (i < period - 1) {
      continue;
    }
    if (i === period - 1) {
      const seed = values.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
      previous = seed;
      result[i] = round(seed, 6);
      continue;
    }
    previous = value * multiplier + (previous ?? value) * (1 - multiplier);
    result[i] = round(previous, 6);
  }

  return result;
}

function calculateSma(values: number[], period: number) {
  return values.map((_, index) => {
    if (index < period - 1) {
      return null;
    }
    const slice = values.slice(index - period + 1, index + 1);
    return round(slice.reduce((sum, item) => sum + item, 0) / period, 6);
  });
}

function calculateRsi(values: number[], period: number) {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length <= period) {
    return result;
  }

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : round(100 - 100 / (1 + avgGain / avgLoss), 4);

  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : round(100 - 100 / (1 + avgGain / avgLoss), 4);
  }

  return result;
}

function calculateMacd(values: number[]) {
  const ema12 = calculateEma(values, 12);
  const ema26 = calculateEma(values, 26);
  const macd = values.map((_, index) => {
    if (ema12[index] === null || ema26[index] === null) {
      return null;
    }
    return round((ema12[index] ?? 0) - (ema26[index] ?? 0), 6);
  });

  const macdValues = macd.map((value) => value ?? 0);
  const signal = calculateEma(macdValues, 9).map((value, index) => (macd[index] === null ? null : value));
  const histogram = macd.map((value, index) => {
    if (value === null || signal[index] === null) {
      return null;
    }
    return round(value - (signal[index] ?? 0), 6);
  });

  return { macd, signal, histogram };
}

export function enrichCandles(candles: Candle[]): IndicatorPoint[] {
  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const ema20 = calculateEma(closes, 20);
  const ema60 = calculateEma(closes, 60);
  const rsi14 = calculateRsi(closes, 14);
  const volumeSma20 = calculateSma(volumes, 20);
  const macd = calculateMacd(closes);

  return candles.map((candle, index) => ({
    ...candle,
    ema20: ema20[index],
    ema60: ema60[index],
    rsi14: rsi14[index],
    volumeSma20: volumeSma20[index],
    macd: macd.macd[index],
    macdSignal: macd.signal[index],
    macdHistogram: macd.histogram[index],
  }));
}

