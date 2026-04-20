import { isSameDay, startOfMonth, startOfYear } from "date-fns";
import { round } from "@/lib/utils";

export type ClosedTradeMetric = {
  assetCode: string;
  executedAt: Date;
  realizedPnl: number;
  realizedReturn: number;
};

export function calculateAnalytics(trades: ClosedTradeMetric[]) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const totalRealizedPnl = trades.reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const todayRealizedPnl = trades
    .filter((trade) => isSameDay(trade.executedAt, now))
    .reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const monthRealizedPnl = trades
    .filter((trade) => trade.executedAt >= monthStart)
    .reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const yearRealizedPnl = trades
    .filter((trade) => trade.executedAt >= yearStart)
    .reduce((sum, trade) => sum + trade.realizedPnl, 0);

  const wins = trades.filter((trade) => trade.realizedPnl > 0).length;
  const tradeCount = trades.length;
  const winRate = tradeCount === 0 ? 0 : (wins / tradeCount) * 100;
  const avgReturnRate =
    tradeCount === 0 ? 0 : trades.reduce((sum, trade) => sum + trade.realizedReturn, 0) / tradeCount;
  const maxLoss = trades.length === 0 ? 0 : Math.min(...trades.map((trade) => trade.realizedPnl));

  let maxConsecutiveLosses = 0;
  let currentLosses = 0;
  for (const trade of trades.sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime())) {
    if (trade.realizedPnl < 0) {
      currentLosses += 1;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
    } else {
      currentLosses = 0;
    }
  }

  const byAsset = Array.from(
    trades.reduce((map, trade) => {
      const current = map.get(trade.assetCode) ?? { assetCode: trade.assetCode, count: 0, wins: 0, totalReturn: 0 };
      current.count += 1;
      current.totalReturn += trade.realizedReturn;
      if (trade.realizedPnl > 0) {
        current.wins += 1;
      }
      map.set(trade.assetCode, current);
      return map;
    }, new Map<string, { assetCode: string; count: number; wins: number; totalReturn: number }>())
  ).map(([_, value]) => ({
    assetCode: value.assetCode,
    tradeCount: value.count,
    winRate: value.count === 0 ? 0 : round((value.wins / value.count) * 100, 2),
    avgReturnRate: value.count === 0 ? 0 : round(value.totalReturn / value.count, 2),
  }));

  return {
    todayRealizedPnl: round(todayRealizedPnl, 2),
    monthRealizedPnl: round(monthRealizedPnl, 2),
    yearRealizedPnl: round(yearRealizedPnl, 2),
    totalRealizedPnl: round(totalRealizedPnl, 2),
    winRate: round(winRate, 2),
    avgReturnRate: round(avgReturnRate, 2),
    maxLoss: round(maxLoss, 2),
    maxConsecutiveLosses,
    tradeCount,
    byAsset,
  };
}

