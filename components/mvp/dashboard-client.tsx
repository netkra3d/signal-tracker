"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RecentSignals } from "@/components/dashboard/recent-signals";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { Card } from "@/components/common/card";
import {
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
  const settings = getSettings();

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
    let active = true;

    async function load(forceRefresh = false) {
      await Promise.all(assets.map((asset) => loadMarketDataForAsset(asset.code, forceRefresh)));
      const currentFx = await getUsdKrwRate(forceRefresh);

      if (!active) {
        return;
      }

      setFx(currentFx);
      setAnalytics(getAnalyticsSnapshot());
      setPositions(getPositions());
      setSignals(getRecentSignals());
      setLoading(false);
      setRefreshing(false);
    }

    void load();

    const interval = window.setInterval(() => {
      if (!document.hidden) {
        setRefreshing(true);
        void load(true);
      }
    }, 60_000);

    const handleFocus = () => {
      setRefreshing(true);
      void load(true);
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [assets]);

  if (loading || !analytics) {
    return <div className="text-sm text-slate-300">240분봉 기준 대시보드를 불러오는 중이다.</div>;
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
          <p className="mt-2 text-sm text-slate-400">
            현재 실제 가격과 신호 기준봉 종가를 분리해서 보여준다. 미국 ETF는 프리마켓이나 애프터마켓이 열리면 그 가격을 우선 반영한다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!refreshing) {
                setRefreshing(true);
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
        <RecentSignals signals={signals} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">240분봉 매수 후보</h2>
            <span className="text-xs text-slate-400">현재가가 1차 진입가에서 ±3% 이내</span>
          </div>
          {candidates.length === 0 ? (
            <p className="text-sm text-slate-400">지금 바로 볼 만한 매수 후보가 없다.</p>
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {assets.map((asset) => {
            const quote = getCachedQuote(asset.code);
            return (
              <div key={asset.code} className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm">
                <p className="font-medium text-white">{asset.name}</p>
                <p className="mt-2 text-cyan-100">{formatCurrency(quote?.price ?? 0, asset.currency)}</p>
                <p className="mt-1 text-slate-400">{getQuoteMetaLabel(asset.marketType, quote)}</p>
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
