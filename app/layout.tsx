import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/common/app-shell";
import { AppGuard } from "@/components/mvp/app-guard";

export const metadata: Metadata = {
  title: "Signal Tracker",
  description: "60분봉 매매 신호와 거래 기록을 관리하는 개인용 투자 일지 앱",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AppGuard>
          <AppShell>{children}</AppShell>
        </AppGuard>
      </body>
    </html>
  );
}
