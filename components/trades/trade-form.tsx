"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_TIMEFRAME_LABEL, getPositionByAssetId, getSettings } from "@/lib/mvp-store";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { TradeFormInput } from "@/types/trade";

type AssetOption = {
  id: string;
  name: string;
  code: string;
};

export function TradeForm({
  assets,
  onCreateTrade,
}: {
  assets: AssetOption[];
  onCreateTrade: (input: TradeFormInput) => Promise<void> | void;
}) {
  const settings = useMemo(() => getSettings(), []);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    assetId: assets[0]?.id ?? "",
    side: "BUY",
    stage: "ONE",
    executedAt: new Date().toISOString().slice(0, 16),
    quantity: "0",
    price: "0",
    fee: String(settings.defaultFeeRate),
    memo: "",
  });

  useEffect(() => {
    setForm((current) => ({ ...current, fee: String(settings.defaultFeeRate) }));
  }, [settings.defaultFeeRate]);

  const selectedPosition = getPositionByAssetId(form.assetId);
  const selectedAsset = assets.find((asset) => asset.id === form.assetId);
  const amount = Number(form.quantity || 0) * Number(form.price || 0);
  const modeLabel = form.side === "BUY" ? "매수 기록 입력" : "매도 기록 입력";
  const helperText =
    form.side === "BUY"
      ? `${DEFAULT_TIMEFRAME_LABEL} 신호를 참고하더라도, 실제 체결된 가격으로 기록하면 된다.`
      : "매도는 보유 수량보다 많이 입력할 수 없고, 실현손익은 자동 계산된다.";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onCreateTrade({
        ...form,
        side: form.side as TradeFormInput["side"],
        stage: form.stage as TradeFormInput["stage"],
        quantity: Number(form.quantity),
        price: Number(form.price),
        fee: Number(form.fee),
      });
      setForm((current) => ({
        ...current,
        quantity: "0",
        price: "0",
        fee: String(settings.defaultFeeRate),
        memo: "",
      }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
        <p className="font-medium">{modeLabel}</p>
        <p className="mt-1">{helperText}</p>
      </div>

      {selectedPosition ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
          <p>
            현재 포지션 {selectedAsset?.name} / 보유 {formatNumber(selectedPosition.quantity, 8)} / 평균 매입가{" "}
            {formatCurrency(selectedPosition.avgEntryPrice, selectedPosition.asset.currency)}
          </p>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span>자산</span>
          <select
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            value={form.assetId}
            onChange={(event) => setForm((current) => ({ ...current, assetId: event.target.value }))}
          >
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} ({asset.code})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span>매수 / 매도</span>
          <select
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            value={form.side}
            onChange={(event) => setForm((current) => ({ ...current, side: event.target.value }))}
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span>차수</span>
          <select
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            value={form.stage}
            onChange={(event) => setForm((current) => ({ ...current, stage: event.target.value }))}
          >
            <option value="ONE">1차</option>
            <option value="TWO">2차</option>
            <option value="THREE">3차</option>
            <option value="FULL">전량</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span>체결 시각</span>
          <input
            type="datetime-local"
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            value={form.executedAt}
            onChange={(event) => setForm((current) => ({ ...current, executedAt: event.target.value }))}
          />
        </label>

        <label className="space-y-2 text-sm">
          <span>수량</span>
          <input
            type="number"
            step="0.00000001"
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            value={form.quantity}
            onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
          />
        </label>

        <label className="space-y-2 text-sm">
          <span>가격</span>
          <input
            type="number"
            step="0.0001"
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            value={form.price}
            onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
          />
        </label>

        <label className="space-y-2 text-sm">
          <span>수수료</span>
          <input
            type="number"
            step="0.0001"
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            value={form.fee}
            onChange={(event) => setForm((current) => ({ ...current, fee: event.target.value }))}
          />
        </label>

        <label className="space-y-2 text-sm">
          <span>메모</span>
          <input
            type="text"
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            value={form.memo}
            onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))}
          />
        </label>

        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm text-cyan-100">
          총액 자동 계산 {formatNumber(amount, 4)}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
        >
          {submitting ? "저장 중..." : "거래 저장"}
        </button>
      </form>
    </div>
  );
}
