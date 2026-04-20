"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/common/card";
import { TradeForm } from "@/components/trades/trade-form";
import { DEFAULT_TIMEFRAME_LABEL, getAssetById, getUsdKrwRate, listMvpAssets, readTrades, saveTrade, type FxRateSnapshot } from "@/lib/mvp-store";
import { formatCurrency, formatDateTime, formatKrwEquivalent, formatPercent } from "@/lib/utils";
import { TradeFormInput } from "@/types/trade";

export function TradesClient() {
  const [trades, setTrades] = useState(readTrades());
  const [error, setError] = useState("");
  const [fx, setFx] = useState<FxRateSnapshot | null>(null);
  const assets = listMvpAssets();

  useEffect(() => {
    setTrades(readTrades());
    void getUsdKrwRate().then(setFx);
  }, []);

  async function handleCreateTrade(input: TradeFormInput) {
    try {
      await saveTrade(input);
      setTrades(readTrades());
      setFx(await getUsdKrwRate());
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "거래를 저장하지 못했습니다.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Trade Journal</p>
        <h1 className="mt-2 text-4xl font-semibold">거래 기록과 원화 환산 일지</h1>
        <p className="mt-2 text-sm text-slate-400">{DEFAULT_TIMEFRAME_LABEL} 기준 앱이지만 체결 가격은 실제 주문한 가격으로 직접 기록합니다.</p>
        {fx ? <p className="mt-2 text-sm text-slate-400">오늘 환율 기준: $1 = {formatCurrency(fx.rate, "KRW")}</p> : null}
      </div>

      {error ? <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <TradeForm assets={assets.map((asset) => ({ id: asset.id, code: asset.code, name: asset.name }))} onCreateTrade={handleCreateTrade} />

      <Card>
        <h2 className="mb-4 text-lg font-semibold">최근 거래</h2>
        {trades.length === 0 ? (
          <p className="text-sm text-slate-400">아직 저장한 거래가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="pb-3">시간</th>
                  <th className="pb-3">자산</th>
                  <th className="pb-3">구분</th>
                  <th className="pb-3">차수</th>
                  <th className="pb-3">수량</th>
                  <th className="pb-3">체결가</th>
                  <th className="pb-3">체결금액</th>
                  <th className="pb-3">원화환산</th>
                  <th className="pb-3">실현손익</th>
                  <th className="pb-3">원화손익</th>
                  <th className="pb-3">수익률</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => {
                  const asset = getAssetById(trade.assetId);
                  const currency = asset?.currency ?? "KRW";

                  return (
                    <tr key={trade.id} className="border-t border-white/5">
                      <td className="py-3">{formatDateTime(trade.executedAt)}</td>
                      <td>{asset?.name ?? trade.assetId}</td>
                      <td>{trade.side}</td>
                      <td>{trade.stage}</td>
                      <td>{trade.quantity}</td>
                      <td>{formatCurrency(trade.price, currency)}</td>
                      <td>{formatCurrency(trade.amount, currency)}</td>
                      <td>{formatKrwEquivalent(trade.krwAmount)}</td>
                      <td>{formatCurrency(trade.realizedPnl, currency)}</td>
                      <td>{formatCurrency(trade.krwRealizedPnl, "KRW")}</td>
                      <td>{formatPercent(trade.realizedReturn)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
