export type AssetCode =
  | "USDT_KRW"
  | "BTC_KRW"
  | "ETH_KRW"
  | "SOL_KRW"
  | "XRP_KRW"
  | "VOO"
  | "QQQ"
  | "DIA"
  | "GLD"
  | "SLV"
  | "IWM"
  | "SMH"
  | "XLK"
  | "XLF"
  | "XLI"
  | "XLV"
  | "XLE"
  | "XLY"
  | "XLP"
  | "XLU"
  | "XLC"
  | "XLB"
  | "XLRE"
  | "XBI"
  | "TLT";

export type AssetSummary = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  currency: string;
  marketType: string;
  isActive: boolean;
};
