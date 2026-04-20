export type AssetCode =
  | "USDT_KRW"
  | "BTC_KRW"
  | "VOO"
  | "QQQ"
  | "GLD"
  | "SLV"
  | "KODEX_USD_FUTURES"
  | "TIGER_KRX_GOLD";

export type AssetSummary = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  currency: string;
  marketType: string;
  isActive: boolean;
};

