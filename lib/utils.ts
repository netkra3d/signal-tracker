import { UTCTimestamp } from "lightweight-charts";
import { clsx } from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatCurrency(value: number, currency: "KRW" | "USD" | string = "KRW") {
  const locale = currency === "USD" ? "en-US" : "ko-KR";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
  }).format(value);
}

export function formatNumber(value: number, maximumFractionDigits = 4) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits }).format(value);
}

export function formatKrwEquivalent(value: number) {
  return `원화환산 ${formatCurrency(value, "KRW")}`;
}

export function formatPercent(value: number) {
  return `${round(value, 2).toFixed(2)}%`;
}

export function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString("ko-KR");
}

export function asChartTime(value: string | Date) {
  return Math.floor(new Date(value).getTime() / 1000) as UTCTimestamp;
}
