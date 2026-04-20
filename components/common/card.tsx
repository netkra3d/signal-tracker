import { PropsWithChildren } from "react";

export function Card({ children }: PropsWithChildren) {
  return <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20">{children}</section>;
}

