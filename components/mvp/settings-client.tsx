"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/common/card";
import {
  DEFAULT_SETTINGS,
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
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettings(getSettings());
    setReady(true);
  }, []);

  const importMeta = useMemo(() => storageRepository.readImportMeta(), [message]);

  if (!ready) {
    return <div className="text-sm text-slate-300">설정을 불러오는 중...</div>;
  }

  function updateSettings(next: AppSettings) {
    setSettings(next);
    saveSettings(next);
    setMessage("설정을 저장했습니다.");
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
        <h1 className="mt-2 text-4xl font-semibold">실사용 설정과 백업 관리</h1>
      </div>

      {message ? <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">기본 전략 설정</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span>기본 수수료(%)</span>
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
          <h2 className="mb-4 text-lg font-semibold">앱 보호</h2>
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
              현재 잠금은 브라우저 단 간단 보호용입니다. 민감 정보는 저장하지 않으며, 배포 후에도 본인 기기에서만 가볍게 접근을 제한하는 수준입니다.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
