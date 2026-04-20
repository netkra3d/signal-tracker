"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/common/card";
import { getAnalyticsSnapshot } from "@/lib/mvp-store";
import { formatCurrency, formatPercent } from "@/lib/utils";

export function AnalyticsClient() {
  const [analytics, setAnalytics] = useState<ReturnType<typeof getAnalyticsSnapshot> | null>(null);

  useEffect(() => {
    setAnalytics(getAnalyticsSnapshot());
  }, []);

  if (!analytics) {
    return <div className="text-sm text-slate-300">분석 데이터를 불러오는 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Analytics</p>
        <h1 className="mt-2 text-4xl font-semibold">일간, 월간, 연간 성과 분석</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-400">오늘 수익</p>
          <p className="mt-3 text-3xl font-semibold">{formatCurrency(analytics.todayRealizedPnl)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">이번 달 수익</p>
          <p className="mt-3 text-3xl font-semibold">{formatCurrency(analytics.monthRealizedPnl)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">올해 수익</p>
          <p className="mt-3 text-3xl font-semibold">{formatCurrency(analytics.yearRealizedPnl)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">총 누적 수익</p>
          <p className="mt-3 text-3xl font-semibold">{formatCurrency(analytics.totalRealizedPnl)}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">핵심 지표</h2>
          <div className="space-y-3 text-sm">
            <p>승률: {formatPercent(analytics.winRate)}</p>
            <p>평균 수익률: {formatPercent(analytics.avgReturnRate)}</p>
            <p>최대 손실: {formatCurrency(analytics.maxLoss)}</p>
            <p>최대 연속 손실: {analytics.maxConsecutiveLosses}</p>
            <p>거래 횟수: {analytics.tradeCount}</p>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">자산별 성과</h2>
          <div className="space-y-3 text-sm">
            {analytics.byAsset.length === 0 ? (
              <p className="text-slate-400">매도 기록이 쌓이면 자산별 성과가 표시됩니다.</p>
            ) : (
              analytics.byAsset.map((row) => (
                <div key={row.assetCode} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <p className="font-medium">{row.assetCode}</p>
                  <p>거래 횟수: {row.tradeCount}</p>
                  <p>승률: {formatPercent(row.winRate)}</p>
                  <p>평균 수익률: {formatPercent(row.avgReturnRate)}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

