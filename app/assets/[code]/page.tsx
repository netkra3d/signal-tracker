import { AssetDetailClient } from "@/components/mvp/asset-detail-client";

export default async function AssetPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <AssetDetailClient code={code} />;
}
