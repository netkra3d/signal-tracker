import { Card } from "@/components/common/card";
import { formatCurrency } from "@/lib/utils";
import { SignalView } from "@/types/signal";

export function RecentSignals({ signals }: { signals: SignalView[] }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">최근 신호</h2>
        <span className="text-xs text-slate-400">전략: ema-rsi-macd-volume-v1</span>
      </div>
      {signals.length === 0 ? (
        <p className="text-sm text-slate-400">표시할 신호가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => (
            <div key={signal.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{signal.assetName}</p>
                  <p className="text-xs text-slate-400">{new Date(signal.timestamp).toLocaleString("ko-KR")}</p>
                </div>
                <span className={signal.signalType === "BUY" ? "text-emerald-300" : "text-rose-300"}>
                  {signal.signalType === "BUY" ? "매수 후보" : "매도 후보"}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300">{signal.reasonSummary}</p>
              <p className="mt-2 text-sm text-slate-300">
                신호가: {formatCurrency(signal.signalPrice)} / 목표가: {formatCurrency(signal.targetPrice ?? 0)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

