"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RecentSignals } from "@/components/dashboard/recent-signals";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { Card } from "@/components/common/card";
import {
  getAnalyticsSnapshot,
  getPositions,
  getRecentSignals,
  listMvpAssets,
  loadCandlesForAsset,
  readTrades,
  getSettings,
  calculateStagePlan,
  getSignalLabel,
} from "@/lib/mvp-store";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { SignalView } from "@/types/signal";

type AnalyticsRow = ReturnType<typeof getAnalyticsSnapshot>;
type PositionRows = ReturnType<typeof getPositions>;

export function DashboardClient() {
  const [analytics, setAnalytics] = useState<AnalyticsRow | null>(null);
  const [positions, setPositions] = useState<PositionRows>([]);
  const [signals, setSignals] = useState<SignalView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const assets = listMvpAssets().filter((asset) => asset.supportsLiveData);
      await Promise.all(assets.map((asset) => loadCandlesForAsset(asset.code)));
      if (!active) {
        return;
      }
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
  const recentTrades = readTrades().slice(0, 5);
  const settings = getSettings();

  if (loading || !analytics) {
    return <div className="text-sm text-slate-300">실데이터와 로컬 기록을 불러오는 중...</div>;
  }

  const candidates = signals
    .filter((signal) => signal.signalType === "BUY")
    .slice(0, 3)
    .map((signal) => {
      const plan = calculateStagePlan(signal.signalPrice, settings, signal.signalPrice, signal.stopPrice ?? undefined);
      return { signal, plan };
    });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Signal Tracker</p>
          <h1 className="mt-2 text-4xl font-semibold">실데이터 기반 신호와 매매일지 관리</h1>
          <p className="mt-2 text-sm text-slate-400">업비트 60분봉은 실데이터, 나머지 자산은 샘플 또는 수동 보조 데이터 기준으로 동작합니다.</p>
        </div>
        <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
          SELL 체결 단위 실현손익 집계
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="오늘 수익" value={formatCurrency(analytics.todayRealizedPnl)} />
        <SummaryCard title="이번 달 수익" value={formatCurrency(analytics.monthRealizedPnl)} />
        <SummaryCard title="올해 수익" value={formatCurrency(analytics.yearRealizedPnl)} />
        <SummaryCard title="총 누적 수익" value={formatCurrency(analytics.totalRealizedPnl)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="승률" value={formatPercent(analytics.winRate)} />
        <SummaryCard title="평균 수익률" value={formatPercent(analytics.avgReturnRate)} />
        <SummaryCard title="최대 손실" value={formatCurrency(analytics.maxLoss)} />
        <SummaryCard title="거래 횟수" value={String(analytics.tradeCount)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <PositionsTable positions={positions} />
        <RecentSignals signals={signals} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">다음 매수 후보</h2>
            <span className="text-xs text-slate-400">최근 신호 기준 추천 3개</span>
          </div>
          {candidates.length === 0 ? (
            <p className="text-sm text-slate-400">현재 즉시 추천할 매수 후보가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {candidates.map(({ signal, plan }) => (
                <div key={signal.id} className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{signal.assetName}</p>
                    <span className="text-emerald-300">{getSignalLabel(signal)}</span>
                  </div>
                  <p className="mt-2 text-slate-300">{signal.reasonSummary}</p>
                  <p className="mt-2 text-slate-300">
                    1차 {formatCurrency(plan.entry1)} / 2차 {formatCurrency(plan.entry2)} / 3차 {formatCurrency(plan.entry3)}
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
            <p className="text-sm text-slate-400">아직 입력된 거래가 없습니다.</p>
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
                    <p className="mt-2 text-slate-300">{new Date(trade.executedAt).toLocaleString("ko-KR")}</p>
                    <p className="mt-1 text-slate-300">
                      {trade.quantity} @ {formatCurrency(trade.price, asset?.currency ?? "KRW")}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

