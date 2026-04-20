"use client";

import { useEffect, useState } from "react";
import { AssetChart } from "@/components/chart/asset-chart";
import { Card } from "@/components/common/card";
import { calculateStagePlan, getAssetDetail, getSettings, getSignalLabel } from "@/lib/mvp-store";
import { formatCurrency } from "@/lib/utils";

export function AssetDetailClient({ code }: { code: string }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getAssetDetail>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const next = await getAssetDetail(code);
      if (!active) {
        return;
      }
      setDetail(next);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [code]);

  if (loading) {
    return <div className="text-sm text-slate-300">자산 데이터를 불러오는 중...</div>;
  }

  if (!detail) {
    return <div className="text-sm text-rose-300">자산을 찾을 수 없습니다.</div>;
  }

  const { asset, indicators, signals, position } = detail;
  const last = indicators[indicators.length - 1];
  const recentLow = Math.min(...indicators.slice(-20).map((candle) => candle.low));
  const settings = getSettings();
  const latestSignal = signals.at(-1) ?? null;
  const plan = calculateStagePlan(last?.close ?? 0, settings, last?.ema20 ?? null, recentLow);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">{asset.marketType}</p>
          <h1 className="mt-2 text-4xl font-semibold">{asset.name}</h1>
          <p className="mt-2 text-slate-400">
            {asset.supportsLiveData ? "업비트 실데이터 60분봉 기준" : "샘플 또는 수동 보조 데이터 기준"}으로 신호와 분할 진입을 계산합니다.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm">
          <p>현재가: {formatCurrency(last?.close ?? 0, asset.currency)}</p>
          <p>20EMA: {formatCurrency(last?.ema20 ?? 0, asset.currency)}</p>
          <p>RSI: {(last?.rsi14 ?? 0).toFixed(2)}</p>
          <p>판정: {getSignalLabel(latestSignal)}</p>
        </div>
      </div>

      <Card>
        <AssetChart candles={indicators} signals={signals} />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">분할 전략 보조 정보</h2>
          <div className="grid gap-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p>1차 진입가: {formatCurrency(plan.entry1, asset.currency)}</p>
              <p>2차 진입가: {formatCurrency(plan.entry2, asset.currency)}</p>
              <p>3차 진입가: {formatCurrency(plan.entry3, asset.currency)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p>평균 매입가 시뮬레이션: {formatCurrency(plan.averagePrice, asset.currency)}</p>
              <p>손절가: {formatCurrency(plan.stopLossPrice, asset.currency)}</p>
              <p>1차 익절가: {formatCurrency(plan.takeProfit1, asset.currency)}</p>
              <p>2차 익절가: {formatCurrency(plan.takeProfit2, asset.currency)}</p>
            </div>
            {latestSignal ? (
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                <p className="font-medium text-cyan-100">{getSignalLabel(latestSignal)}</p>
                <p className="mt-1 text-slate-300">{latestSignal.reasonSummary}</p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">현재 포지션</h2>
          {position ? (
            <div className="space-y-3 text-sm">
              <p>보유 수량: {position.quantity}</p>
              <p>평균 매입가: {formatCurrency(position.avgEntryPrice, asset.currency)}</p>
              <p>평가 손익: {formatCurrency(position.unrealizedPnl, asset.currency)}</p>
              <p>누적 실현손익: {formatCurrency(position.realizedPnlTotal, asset.currency)}</p>
              <p>상태: {position.status}</p>
              <p>포지션 손절 기준가: {formatCurrency(position.avgEntryPrice * (1 - settings.stopLossRate / 100), asset.currency)}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">아직 기록된 포지션이 없습니다.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

