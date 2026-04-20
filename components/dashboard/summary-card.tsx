import { Card } from "@/components/common/card";

export function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description?: string;
}) {
  return (
    <Card>
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      {description ? <p className="mt-2 text-xs text-slate-500">{description}</p> : null}
    </Card>
  );
}

