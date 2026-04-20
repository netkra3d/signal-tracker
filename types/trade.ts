export type TradeFormInput = {
  assetId: string;
  side: "BUY" | "SELL";
  stage: "ONE" | "TWO" | "THREE" | "FULL";
  executedAt: string;
  quantity: number;
  price: number;
  fee?: number;
  memo?: string;
  signalId?: string;
};

export type PositionSnapshot = {
  assetId: string;
  quantity: number;
  avgEntryPrice: number;
  totalCost: number;
  unrealizedPnl: number;
  realizedPnlTotal: number;
  status: "FLAT" | "ENTRY_1" | "ENTRY_2" | "ENTRY_3" | "EXITING" | "CLOSED";
};

