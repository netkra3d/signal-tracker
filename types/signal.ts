export type SignalStage = 1 | 2 | 3;

export type SignalView = {
  id: string;
  assetCode: string;
  assetName: string;
  timestamp: string;
  signalType: "BUY" | "SELL";
  signalStage: SignalStage;
  strategyName: string;
  signalPrice: number;
  stopPrice: number | null;
  targetPrice: number | null;
  reasonSummary: string;
  status: "NEW" | "USED" | "IGNORED";
};

