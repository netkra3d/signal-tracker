import { Card } from "@/components/common/card";
import { DEFAULT_TIMEFRAME_LABEL, getSignalLabel } from "@/lib/mvp-store";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { SignalView } from "@/types/signal";

const CURRENCY_BY_ASSET: Record<string, "KRW" | "USD"> = {
  USDT_KRW: "KRW",
  BTC_KRW: "KRW",
  VOO: "USD",
  QQQ: "USD",
  GLD: "USD",
  SLV: "USD",
  IWM: "USD",
  SMH: "USD",
  XLK: "USD",
};

function getSignalColor(signalType: SignalView["signalType"]) {
  return signalType === "BUY" ? "text-red-300" : "text-blue-300";
}

export function RecentSignals({ signals }: { signals: SignalView[] }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">최근 신호</h2>
        <span className="text-xs text-slate-400">{DEFAULT_TIMEFRAME_LABEL} 기준</span>
      </div>
      {signals.length === 0 ? (
        <p className="text-sm text-slate-400">표시할 최근 신호가 없다.</p>
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => {
            const currency = CURRENCY_BY_ASSET[signal.assetCode] ?? "KRW";
            return (
              <div key={signal.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{signal.assetName}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(signal.timestamp)}</p>
                  </div>
                  <span className={getSignalColor(signal.signalType)}>{getSignalLabel(signal)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{signal.reasonSummary}</p>
                <div className="mt-2 text-sm text-slate-300">
                  <p>신호가 나온 가격 {formatCurrency(signal.signalPrice, currency)}</p>
                  {signal.signalType === "BUY" && signal.stopPrice ? (
                    <p>손절가 {formatCurrency(signal.stopPrice, currency)}</p>
                  ) : null}
                  {signal.signalType === "SELL" ? <p>지금 매도 검토</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
