"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/common/card";
import {
  EXPORT_VERSION,
  exportLocalData,
  importLocalData,
  storageRepository,
  type ExportPayload,
} from "@/lib/mvp-store";

export function SettingsClient() {
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const refresh = () => {
      setReady(true);
      setRefreshKey((value) => value + 1);
    };

    refresh();
    window.addEventListener("signal-tracker:data-changed", refresh);

    return () => {
      window.removeEventListener("signal-tracker:data-changed", refresh);
    };
  }, []);

  const importMeta = useMemo(() => storageRepository.readImportMeta(), [refreshKey]);

  if (!ready) {
    return <div className="text-sm text-slate-300">백업 화면을 불러오는 중입니다.</div>;
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
      setRefreshKey((value) => value + 1);
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
        <h1 className="mt-2 text-4xl font-semibold">백업 / 복원</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
          평소 기록은 자동 동기화되며, JSON 파일은 비상용 수동 백업과 복원에만 사용합니다.
        </p>
      </div>

      {message ? <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">{message}</div> : null}

      <Card>
        <h2 className="mb-4 text-lg font-semibold">현재 동기화 방식</h2>
        <div className="space-y-3 text-sm text-slate-300">
          <p>지금은 로그인 없이 네 기기끼리 같은 데이터를 공유하는 개인용 동기화 모드입니다.</p>
          <p>다른 사람이 같은 앱에 접속해 저장하면 같은 데이터에 함께 반영될 수 있으므로, 공개 서비스 용도로는 아직 적합하지 않습니다.</p>
          <p className="text-slate-400">나중에 공개하거나 유료화할 때는 로그인과 사용자별 데이터 구조로 바꿔야 합니다.</p>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">백업 파일 관리</h2>
        <div className="space-y-4 text-sm">
          <p>거래 기록과 메모를 JSON 파일로 내보내거나, 이전에 저장한 백업 파일을 다시 불러올 수 있습니다.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleExport} className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950">
              JSON 내보내기
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-2xl border border-white/10 px-4 py-3 font-semibold">
              JSON 불러오기
            </button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </div>
          <p className="text-slate-400">
            마지막 불러오기: {importMeta.lastImportedAt ? new Date(importMeta.lastImportedAt).toLocaleString("ko-KR") : "없음"}
          </p>
        </div>
      </Card>
    </div>
  );
}
