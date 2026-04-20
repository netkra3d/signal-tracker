"use client";

import { useEffect, useState } from "react";
import { AssetChart } from "@/components/chart/asset-chart";
import { Card } from "@/components/common/card";
import { DEFAULT_TIMEFRAME_LABEL, calculateStagePlan, getAssetDetail, getSignalLabel, getSettings, isActionableBuySignal } from "@/lib/mvp-store";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/utils";

function getQuoteMetaLabel(marketType: string, isStale?: boolean, isMarketOpen?: boolean, isExtendedHours?: boolean) {
  if (isStale) {
    return "실시간 조회 실패, 저장된 마지막 값";
  }

  if (marketType === "US_STOCK") {
    if (isExtendedHours) {
      return "미국 프리마켓/애프터마켓 반영 시각 (한국시간)";
    }

    return isMarketOpen ? "미국장 최신 반영 시각 (한국시간)" : "미국장 마지막 반영 시각 (한국시간)";
  }

  return "최신 반영 시각 (한국시간)";
}

export function AssetDetailClient({ code }: { code: string }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getAssetDetail>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;

    async function load(forceRefresh = false) {
      const next = await getAssetDetail(code, forceRefresh);
      if (!active) {
        return;
      }
      setDetail(next);
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
  }, [code]);

  if (loading) {
    return <div className="text-sm text-slate-300">자산 데이터를 불러오는 중이다.</div>;
  }

  if (!detail) {
    return <div className="text-sm text-rose-300">자산을 찾을 수 없다.</div>;
  }

  const { asset, indicators, signals, position, quote } = detail;
  const last = indicators[indicators.length - 1];
  const recentLow = indicators.length > 0 ? Math.min(...indicators.slice(-20).map((candle) => candle.low)) : 0;
  const settings = getSettings();
  const latestSignal = signals.at(-1) ?? null;
  const plan = calculateStagePlan(latestSignal?.signalPrice ?? last?.close ?? 0, settings, last?.ema20 ?? null, recentLow);
  const divergence = quote && latestSignal ? ((quote.price - latestSignal.signalPrice) / latestSignal.signalPrice) * 100 : 0;
  const actionable = latestSignal ? isActionableBuySignal(latestSignal, quote) : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">{asset.marketType}</p>
          <h1 className="mt-2 text-4xl font-semibold">{asset.name}</h1>
          <p className="mt-2 text-slate-400">
            {DEFAULT_TIMEFRAME_LABEL} 기준으로 신호를 계산하고, 현재 실제 가격은 프리마켓이나 애프터마켓까지 포함해 별도로 보여준다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!refreshing) {
                setRefreshing(true);
                void getAssetDetail(code, true).then((next) => {
                  setDetail(next);
                  setRefreshing(false);
                });
              }
            }}
            disabled={refreshing}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            {refreshing ? "새로고침 중..." : "실제 가격 새로고침"}
          </button>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm">
            <p>현재가: {formatCurrency(quote?.price ?? 0, asset.currency)}</p>
            <p>{getQuoteMetaLabel(asset.marketType, quote?.isStale, quote?.isMarketOpen, quote?.isExtendedHours)}: {quote ? formatDateTime(quote.timestamp) : "없음"}</p>
            <p>
              {asset.marketType === "US_STOCK"
                ? quote?.isExtendedHours
                  ? "프리마켓 또는 애프터마켓 반영"
                  : quote?.isMarketOpen
                    ? "미국장 진행중"
                    : "미국장 마감 또는 개장 전"
                : "국내 시장 반영"}
            </p>
            <p>신호 기준봉 종가: {formatCurrency(latestSignal?.signalPrice ?? last?.close ?? 0, asset.currency)}</p>
            <p>현재 상태: {latestSignal ? getSignalLabel(latestSignal) : "관망"}</p>
          </div>
        </div>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">240분봉 차트</h2>
          <span className="text-xs text-slate-400">EMA20 / EMA60 / 최근 신호</span>
        </div>
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
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
              <p className="font-medium text-cyan-100">{latestSignal ? getSignalLabel(latestSignal) : "관망"}</p>
              <p className="mt-1 text-slate-300">{latestSignal?.reasonSummary ?? "아직 최근 신호가 없다."}</p>
              <p className="mt-2 text-slate-300">현재가와 1차 진입가 괴리: {formatPercent(divergence)}</p>
              <p className="mt-1 text-slate-300">지금 판단: {actionable ? "매수 후보 유지" : "관망"}</p>
            </div>
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
              <p>포지션 기준 손절가: {formatCurrency(position.avgEntryPrice * (1 - settings.stopLossRate / 100), asset.currency)}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">아직 기록된 포지션이 없다.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
