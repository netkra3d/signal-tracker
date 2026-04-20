import { PositionSnapshot } from "@/types/trade";
import { round } from "@/lib/utils";

export type FlatTrade = {
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  fee: number;
};

export function getPositionStatus(quantity: number): PositionSnapshot["status"] {
  if (quantity <= 0) {
    return "FLAT";
  }

  return "ENTRY_1";
}

export function calculateTradeAmount(quantity: number, price: number) {
  return round(quantity * price, 8);
}

export function reduceTradesToPosition(trades: FlatTrade[], lastPrice?: number): PositionSnapshot {
  let quantity = 0;
  let totalCost = 0;
  let avgEntryPrice = 0;
  let realizedPnlTotal = 0;

  for (const trade of trades) {
    if (trade.side === "BUY") {
      const gross = trade.quantity * trade.price + trade.fee;
      quantity += trade.quantity;
      totalCost += gross;
      avgEntryPrice = quantity > 0 ? totalCost / quantity : 0;
      continue;
    }

    const matchedCost = avgEntryPrice * trade.quantity;
    const netSell = trade.quantity * trade.price - trade.fee;
    realizedPnlTotal += netSell - matchedCost;
    quantity -= trade.quantity;
    totalCost -= matchedCost;
    if (quantity <= 0) {
      quantity = 0;
      totalCost = 0;
      avgEntryPrice = 0;
    } else {
      avgEntryPrice = totalCost / quantity;
    }
  }

  const markPrice = lastPrice ?? avgEntryPrice;
  const unrealizedPnl = quantity > 0 ? quantity * (markPrice - avgEntryPrice) : 0;

  return {
    assetId: "",
    quantity: round(quantity, 8),
    avgEntryPrice: round(avgEntryPrice, 8),
    totalCost: round(totalCost, 8),
    unrealizedPnl: round(unrealizedPnl, 8),
    realizedPnlTotal: round(realizedPnlTotal, 8),
    status: getPositionStatus(quantity),
  };
}

export function calculateSellPnl(avgEntryPrice: number, quantity: number, price: number, fee: number) {
  const grossCost = avgEntryPrice * quantity;
  const netSell = quantity * price - fee;
  const realizedPnl = netSell - grossCost;
  const realizedReturn = grossCost === 0 ? 0 : (realizedPnl / grossCost) * 100;

  return {
    realizedPnl: round(realizedPnl, 8),
    realizedReturn: round(realizedReturn, 4),
  };
}

