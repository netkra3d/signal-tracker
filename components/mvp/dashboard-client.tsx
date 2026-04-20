"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RecentSignals } from "@/components/dashboard/recent-signals";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { Card } from "@/components/common/card";
import {
  DEFAULT_TIMEFRAME_LABEL,
  calculateStagePlan,
  getAnalyticsSnapshot,
  getCachedQuote,
  getPositions,
  getRecentSignals,
  getSettings,
  getSignalLabel,
  getUsdKrwRate,
  isActionableBuySignal,
  listMvpAssets,
  loadMarketDataForAsset,
  readTrades,
  type FxRateSnapshot,
} from "@/lib/mvp-store";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/utils";
import { SignalView } from "@/types/signal";

type AnalyticsRow = ReturnType<typeof getAnalyticsSnapshot>;
type PositionRows = ReturnType<typeof getPositions>;

export function DashboardClient() {
  const [analytics, setAnalytics] = useState<AnalyticsRow | null>(null);
  const [positions, setPositions] = useState<PositionRows>([]);
  const [signals, setSignals] = useState<SignalView[]>([]);
  const [fx, setFx] = useState<FxRateSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      await Promise.all(listMvpAssets().map((asset) => loadMarketDataForAsset(asset.code)));
      const currentFx = await getUsdKrwRate();

      if (!active) {
        return;
      }

      setFx(currentFx);
      setAnalytics(getAnalyticsSnapshot());
      setPositions(getPositions());
      setSignals(getRecentSignals());
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const assets = listMvpAssets();
  const recentTrades = useMemo(() => readTrades().slice(0, 5), []);
  const settings = getSettings();

  if (loading || !analytics) {
    return <div className="text-sm text-slate-300">240분봉 기준 대시보드를 불러오는 중입니다.</div>;
  }

  const candidates = signals
    .filter((signal) => signal.signalType === "BUY")
    .map((signal) => {
      const asset = assets.find((item) => item.code === signal.assetCode);
      const quote = getCachedQuote(signal.assetCode);
      const plan = calculateStagePlan(signal.signalPrice, settings, signal.signalPrice, signal.stopPrice ?? undefined);
      return { signal, asset, quote, plan };
    })
    .filter((item) => item.asset && isActionableBuySignal(item.signal, item.quote))
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Signal Tracker</p>
          <h1 className="mt-2 text-4xl font-semibold">240분봉 단일 기준 대시보드</h1>
          <p className="mt-2 text-sm text-slate-400">현재 실제 가격과 신호 기준봉 종가를 분리해서 보여줍니다. 분석 수익은 원화 기준으로 집계합니다.</p>
        </div>
        <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
          {fx ? `오늘 환율 $1 = ${formatCurrency(fx.rate, "KRW")}` : "환율 로딩 중"}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="오늘 수익" value={formatCurrency(analytics.todayRealizedPnl, "KRW")} />
        <SummaryCard title="이번 달 수익" value={formatCurrency(analytics.monthRealizedPnl, "KRW")} />
        <SummaryCard title="올해 수익" value={formatCurrency(analytics.yearRealizedPnl, "KRW")} />
        <SummaryCard title="총 누적 수익" value={formatCurrency(analytics.totalRealizedPnl, "KRW")} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="승률" value={formatPercent(analytics.winRate)} />
        <SummaryCard title="평균 수익률" value={formatPercent(analytics.avgReturnRate)} />
        <SummaryCard title="최대 손실" value={formatCurrency(analytics.maxLoss, "KRW")} />
        <SummaryCard title="거래 횟수" value={String(analytics.tradeCount)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <PositionsTable positions={positions} />
        <RecentSignals signals={signals} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">240분봉 매수 후보</h2>
            <span className="text-xs text-slate-400">현재가가 1차 진입가에서 ±3% 이내</span>
          </div>
          {candidates.length === 0 ? (
            <p className="text-sm text-slate-400">지금 바로 볼 만한 매수 후보가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {candidates.map(({ signal, asset, quote, plan }) => (
                <div key={signal.id} className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{signal.assetName}</p>
                    <span className="text-emerald-300">{getSignalLabel(signal)}</span>
                  </div>
                  <p className="mt-2 text-slate-300">{signal.reasonSummary}</p>
                  <p className="mt-2 text-slate-300">현재가 {formatCurrency(quote?.price ?? 0, asset?.currency ?? "KRW")}</p>
                  <p className="mt-1 text-slate-300">신호 기준봉 종가 {formatCurrency(signal.signalPrice, asset?.currency ?? "KRW")}</p>
                  <p className="mt-1 text-slate-300">
                    1차 {formatCurrency(plan.entry1, asset?.currency ?? "KRW")} / 2차 {formatCurrency(plan.entry2, asset?.currency ?? "KRW")} / 3차{" "}
                    {formatCurrency(plan.entry3, asset?.currency ?? "KRW")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">최근 거래 5건</h2>
            <Link href="/trades" className="text-sm text-cyan-300 hover:text-cyan-200">
              전체 보기
            </Link>
          </div>
          {recentTrades.length === 0 ? (
            <p className="text-sm text-slate-400">아직 입력한 거래가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {recentTrades.map((trade) => {
                const asset = assets.find((item) => item.id === trade.assetId);
                return (
                  <div key={trade.id} className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-white">{asset?.name ?? trade.assetId}</p>
                      <span className={trade.side === "BUY" ? "text-emerald-300" : "text-rose-300"}>{trade.side}</span>
                    </div>
                    <p className="mt-2 text-slate-300">{formatDateTime(trade.executedAt)}</p>
                    <p className="mt-1 text-slate-300">
                      {trade.quantity} @ {formatCurrency(trade.price, asset?.currency ?? "KRW")}
                    </p>
                    <p className="mt-1 text-slate-400">원화환산 {formatCurrency(trade.krwAmount, "KRW")}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">현재 실제 가격</h2>
          <span className="text-xs text-slate-400">{DEFAULT_TIMEFRAME_LABEL} 신호 + 현재가 병행 표시</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {assets.map((asset) => {
            const quote = getCachedQuote(asset.code);
            return (
              <div key={asset.code} className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm">
                <p className="font-medium text-white">{asset.name}</p>
                <p className="mt-2 text-cyan-100">{formatCurrency(quote?.price ?? 0, asset.currency)}</p>
                <p className="mt-1 text-slate-400">{quote ? formatDateTime(quote.timestamp) : "시각 없음"}</p>
                <p className="mt-1 text-slate-500">{quote?.source ?? "cache"}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
