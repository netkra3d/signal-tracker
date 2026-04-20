"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/common/card";
import { TradeForm } from "@/components/trades/trade-form";
import { getAssetById, listMvpAssets, readTrades, saveTrade } from "@/lib/mvp-store";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { TradeFormInput } from "@/types/trade";

export function TradesClient() {
  const [trades, setTrades] = useState(readTrades());
  const [error, setError] = useState("");
  const assets = listMvpAssets();

  useEffect(() => {
    setTrades(readTrades());
  }, []);

  function handleCreateTrade(input: TradeFormInput) {
    try {
      saveTrade(input);
      setTrades(readTrades());
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "거래를 저장하지 못했습니다.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Trade Journal</p>
        <h1 className="mt-2 text-4xl font-semibold">수동 기록과 손익 자동 계산</h1>
      </div>

      {error ? <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <TradeForm assets={assets.map((asset) => ({ id: asset.id, code: asset.code, name: asset.name }))} onCreateTrade={handleCreateTrade} />

      <Card>
        <h2 className="mb-4 text-lg font-semibold">최근 거래</h2>
        {trades.length === 0 ? (
          <p className="text-sm text-slate-400">아직 저장된 거래가 없습니다.</p>
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
                  <th className="pb-3">가격</th>
                  <th className="pb-3">총액</th>
                  <th className="pb-3">실현손익</th>
                  <th className="pb-3">누적손익</th>
                  <th className="pb-3">수익률</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => {
                  const asset = getAssetById(trade.assetId);
                  return (
                    <tr key={trade.id} className="border-t border-white/5">
                      <td className="py-3">{new Date(trade.executedAt).toLocaleString("ko-KR")}</td>
                      <td>{asset?.name ?? trade.assetId}</td>
                      <td>{trade.side}</td>
                      <td>{trade.stage}</td>
                      <td>{trade.quantity}</td>
                      <td>{formatCurrency(trade.price, asset?.currency ?? "KRW")}</td>
                      <td>{formatCurrency(trade.amount, asset?.currency ?? "KRW")}</td>
                      <td>{formatCurrency(trade.realizedPnl, asset?.currency ?? "KRW")}</td>
                      <td>{formatCurrency(trade.cumulativePnl, asset?.currency ?? "KRW")}</td>
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

