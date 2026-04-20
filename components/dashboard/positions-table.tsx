import Link from "next/link";
import { Card } from "@/components/common/card";
import { formatCurrency } from "@/lib/utils";

type PositionRow = {
  asset: { code: string; name: string; currency: string };
  quantity: number;
  avgEntryPrice: number;
  unrealizedPnl: number;
  realizedPnlTotal: number;
  status: string;
  lastPrice?: number;
};

export function PositionsTable({ positions }: { positions: PositionRow[] }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">보유 포지션</h2>
        <span className="text-xs text-slate-400">자산 원통화 기준</span>
      </div>
      {positions.length === 0 ? (
        <p className="text-sm text-slate-400">아직 기록된 포지션이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="pb-3">자산</th>
                <th className="pb-3">수량</th>
                <th className="pb-3">평균단가</th>
                <th className="pb-3">현재가</th>
                <th className="pb-3">평가손익</th>
                <th className="pb-3">누적실현손익</th>
                <th className="pb-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.asset.code} className="border-t border-white/5">
                  <td className="py-3">
                    <Link href={`/assets/${position.asset.code}`} className="font-medium hover:text-cyan-300">
                      {position.asset.name}
                    </Link>
                  </td>
                  <td>{position.quantity}</td>
                  <td>{formatCurrency(position.avgEntryPrice, position.asset.currency)}</td>
                  <td>{formatCurrency(position.lastPrice ?? 0, position.asset.currency)}</td>
                  <td>{formatCurrency(position.unrealizedPnl, position.asset.currency)}</td>
                  <td>{formatCurrency(position.realizedPnlTotal, position.asset.currency)}</td>
                  <td>{position.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
