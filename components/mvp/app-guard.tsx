"use client";

import { PropsWithChildren, useEffect, useState } from "react";
import { getAppUnlocked, getSettings, setAppUnlocked } from "@/lib/mvp-store";

export function AppGuard({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const settings = getSettings();
    const unlocked = getAppUnlocked();
    setLocked(settings.appLockEnabled && !unlocked);
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="p-6 text-sm text-slate-300">앱을 준비하는 중입니다.</div>;
  }

  if (!locked) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">App Lock</p>
        <h1 className="mt-2 text-3xl font-semibold">브라우저 잠금 해제</h1>
        <p className="mt-3 text-sm text-slate-400">이 잠금은 브라우저 단 보호 기능입니다. 민감 정보는 저장하지 않으며, 본인 기기에서 간단히 접근을 제한하는 용도입니다.</p>
        <input
          type="password"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="mt-5 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
          placeholder="open-sesame"
        />
        {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
        <button
          type="button"
          className="mt-4 w-full rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950"
          onClick={() => {
            if (input === "open-sesame") {
              setAppUnlocked(true);
              setLocked(false);
              setError("");
              return;
            }
            setError("비밀번호가 올바르지 않습니다.");
          }}
        >
          잠금 해제
        </button>
      </div>
    </div>
  );
}
