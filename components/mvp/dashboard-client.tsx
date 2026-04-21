"use client";

import { useEffect, useMemo, useState } from "react";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { Card } from "@/components/common/card";
import {
  getAnalyticsSnapshot,
  getCachedQuote,
  getPositions,
  getRecentSignals,
  getSignalLabel,
  getUsdKrwRate,
  listMvpAssets,
  loadMarketDataForAsset,
  readTrades,
  type FxRateSnapshot,
  type QuoteSnapshot,
} from "@/lib/mvp-store";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/utils";
import { SignalView } from "@/types/signal";

type AnalyticsRow = ReturnType<typeof getAnalyticsSnapshot>;
type PositionRows = ReturnType<typeof getPositions>;

function getQuoteMetaLabel(marketType: string, quote: QuoteSnapshot | null) {
  if (!quote) {
    return "시각 없음";
  }

  if (quote.isStale) {
    return "실시간 조회 실패, 저장된 마지막 값";
  }

  if (marketType === "US_STOCK") {
    if (quote.isExtendedHours) {
      return "미국 프리마켓/애프터마켓 반영 시각 (한국시간)";
    }

    return quote.isMarketOpen ? "미국장 최신 반영 시각 (한국시간)" : "미국장 마지막 반영 시각 (한국시간)";
  }

  return "최신 반영 시각 (한국시간)";
}

function getQuoteStatusLabel(marketType: string, quote: QuoteSnapshot | null) {
  if (!quote) {
    return "상태 없음";
  }

  if (quote.isStale) {
    return "저장된 마지막 값";
  }

  if (marketType === "US_STOCK") {
    if (quote.isExtendedHours) {
      return "프리마켓 또는 애프터마켓 반영";
    }

    return quote.isMarketOpen ? "미국장 진행중" : "미국장 마감 또는 개장 전";
  }

  return "국내 시장 반영";
}

export function DashboardClient() {
  const [analytics, setAnalytics] = useState<AnalyticsRow | null>(null);
  const [positions, setPositions] = useState<PositionRows>([]);
  const [signals, setSignals] = useState<SignalView[]>([]);
  const [fx, setFx] = useState<FxRateSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const assets = listMvpAssets();
  const recentTrades = useMemo(() => readTrades().slice(0, 5), []);

  async function refreshData(forceRefresh = false) {
    if (forceRefresh) {
      setRefreshing(true);
    }

    await Promise.all(assets.map((asset) => loadMarketDataForAsset(asset.code, forceRefresh)));
    const currentFx = await getUsdKrwRate(forceRefresh);

    setFx(currentFx);
    setAnalytics(getAnalyticsSnapshot());
    setPositions(getPositions());
    setSignals(getRecentSignals());
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void refreshData();

    const interval = window.setInterval(() => {
      if (!document.hidden) {
        void refreshData(true);
      }
    }, 60_000);

    const handleFocus = () => {
      void refreshData(true);
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  if (loading || !analytics) {
    return <div className="text-sm text-slate-300">대시보드를 불러오는 중이다.</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Signal Tracker</p>
          <h1 className="mt-2 text-4xl font-semibold">종목 감시 대시보드</h1>
          <p className="mt-2 text-sm text-slate-400">
            각 종목 카드에서 현재 실제 가격, 신호 상태, 신호 기준봉 가격을 한 번에 본다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!refreshing) {
                void refreshData(true);
              }
            }}
            disabled={refreshing}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            {refreshing ? "새로고침 중..." : "실제 가격 새로고침"}
          </button>
          <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
            {fx ? `오늘 환율 $1 = ${formatCurrency(fx.rate, "KRW")}` : "환율 로딩 중"}
          </div>
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
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">최근 거래 5건</h2>
          </div>
          {recentTrades.length === 0 ? (
            <p className="text-sm text-slate-400">아직 입력한 거래가 없다.</p>
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
                    <p className="mt-1 text-slate-400">원화 환산 {formatCurrency(trade.krwAmount, "KRW")}</p>
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
          <span className="text-xs text-slate-400">1분마다 자동 갱신, 창으로 다시 돌아오면 즉시 새로고침</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => {
            const quote = getCachedQuote(asset.code);
            const signal = signals.find((item) => item.assetCode === asset.code) ?? null;

            return (
              <div key={asset.code} className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm">
                <p className="font-medium text-white">{asset.name}</p>
                <p className="mt-2 text-2xl font-semibold text-cyan-100">{formatCurrency(quote?.price ?? 0, asset.currency)}</p>

                {signal ? (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="font-medium text-white">
                      {asset.name} ({getSignalLabel(signal)})
                    </p>
                    <p className="mt-2 text-slate-300">
                      신호 기준봉 종가 {formatCurrency(signal.signalPrice, asset.currency)}
                      {signal.targetPrice ? ` / 목표가 ${formatCurrency(signal.targetPrice, asset.currency)}` : ""}
                    </p>
                  </div>
                ) : null}

                <p className="mt-3 text-slate-400">{getQuoteMetaLabel(asset.marketType, quote)}</p>
                <p className="mt-1 text-slate-400">{quote ? formatDateTime(quote.timestamp) : "시각 없음"}</p>
                <p className="mt-1 text-slate-500">
                  {quote?.source ?? "cache"} / {getQuoteStatusLabel(asset.marketType, quote)}
                </p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
