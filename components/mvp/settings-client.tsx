"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/common/card";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TIMEFRAME,
  DEFAULT_TIMEFRAME_LABEL,
  EXPORT_VERSION,
  exportLocalData,
  getSettings,
  importLocalData,
  saveSettings,
  storageRepository,
  type AppSettings,
  type ExportPayload,
} from "@/lib/mvp-store";

export function SettingsClient() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const refresh = () => {
      setSettings(getSettings());
      setReady(true);
    };

    refresh();
    window.addEventListener("signal-tracker:data-changed", refresh);

    return () => {
      window.removeEventListener("signal-tracker:data-changed", refresh);
    };
  }, []);

  const importMeta = useMemo(() => storageRepository.readImportMeta(), [message]);

  if (!ready) {
    return <div className="text-sm text-slate-300">설정을 불러오는 중입니다.</div>;
  }

  function updateSettings(next: AppSettings) {
    setSettings(next);
    saveSettings(next);
    setMessage("설정이 저장되었습니다.");
  }

  function handleNumberChange<K extends keyof AppSettings>(key: K, value: number) {
    updateSettings({ ...settings, [key]: value } as AppSettings);
  }

  function handleRatioChange(key: "splitBuyRatios" | "splitSellRatios", index: number, value: number) {
    const next = [...settings[key]] as [number, number, number];
    next[index] = value;
    updateSettings({ ...settings, [key]: next } as AppSettings);
  }

  function handleExport() {
    const payload = exportLocalData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `signal-tracker-backup-v${EXPORT_VERSION}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("백업 파일을 내보냈습니다.");
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      const payload = JSON.parse(raw) as ExportPayload;
      importLocalData(payload);
      setSettings(getSettings());
      setMessage("백업 파일을 불러왔습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "백업 파일을 불러오지 못했습니다.");
    } finally {
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Settings</p>
        <h1 className="mt-2 text-4xl font-semibold">기본 설정과 백업 관리</h1>
      </div>

      {message ? <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">{message}</div> : null}

      <Card>
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium text-white">기준 차트</p>
          <p className="text-slate-300">{DEFAULT_TIMEFRAME_LABEL} 고정</p>
          <p className="text-slate-500">이 MVP는 초보자용 단일 기준 앱이라 시간프레임 변경 옵션을 두지 않습니다. 백업 파일에도 `{DEFAULT_TIMEFRAME}`가 함께 저장됩니다.</p>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">기본 전략 설정</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span>기본 수수료 고정값</span>
              <input
                type="number"
                step="0.01"
                value={settings.defaultFeeRate}
                onChange={(event) => handleNumberChange("defaultFeeRate", Number(event.target.value))}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>손절 기준(%)</span>
              <input
                type="number"
                step="0.1"
                value={settings.stopLossRate}
                onChange={(event) => handleNumberChange("stopLossRate", Number(event.target.value))}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
              />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>기본 투자금</span>
              <input
                type="number"
                step="1000"
                value={settings.defaultInvestmentAmount}
                onChange={(event) => handleNumberChange("defaultInvestmentAmount", Number(event.target.value))}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
              />
            </label>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">분할 비중</h2>
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              {settings.splitBuyRatios.map((ratio, index) => (
                <label key={`buy-${index}`} className="space-y-2 text-sm">
                  <span>매수 {index + 1}차(%)</span>
                  <input
                    type="number"
                    value={ratio}
                    onChange={(event) => handleRatioChange("splitBuyRatios", index, Number(event.target.value))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
                  />
                </label>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {settings.splitSellRatios.map((ratio, index) => (
                <label key={`sell-${index}`} className="space-y-2 text-sm">
                  <span>매도 {index + 1}차(%)</span>
                  <input
                    type="number"
                    value={ratio}
                    onChange={(event) => handleRatioChange("splitSellRatios", index, Number(event.target.value))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
                  />
                </label>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">백업 / 복원</h2>
          <div className="space-y-4 text-sm">
            <p>거래 기록, 설정, 메모를 JSON 파일로 백업하거나 다시 불러올 수 있습니다.</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={handleExport} className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950">
                JSON 내보내기
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-2xl border border-white/10 px-4 py-3 font-semibold">
                JSON 불러오기
              </button>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
            </div>
            <p className="text-slate-400">마지막 불러오기: {importMeta.lastImportedAt ? new Date(importMeta.lastImportedAt).toLocaleString("ko-KR") : "없음"}</p>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">브라우저 보호</h2>
          <div className="space-y-4 text-sm">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.appLockEnabled}
                onChange={(event) => updateSettings({ ...settings, appLockEnabled: event.target.checked })}
              />
              <span>브라우저 잠금 사용</span>
            </label>
            <p className="text-slate-400">
              현재 잠금은 브라우저 단의 간단한 보호 기능입니다. 민감 정보는 저장하지 않고, 본인 기기에서만 접근을 제한하는 용도입니다.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
