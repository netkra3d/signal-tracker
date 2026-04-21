import { NextResponse } from "next/server";

type SyncRow = {
  id: string;
  payload: unknown;
  updated_at: string;
};

const SYNC_ROW_ID = process.env.SUPABASE_SYNC_ROW_ID ?? "signal-tracker-shared";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
}

function getHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json({ enabled: false, payload: null, updatedAt: null });
  }

  const response = await fetch(
    `${config.url}/rest/v1/app_state?id=eq.${encodeURIComponent(SYNC_ROW_ID)}&select=payload,updated_at&limit=1`,
    {
      headers: getHeaders(config.serviceRoleKey),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return NextResponse.json({ enabled: true, payload: null, updatedAt: null }, { status: 200 });
  }

  const rows = (await response.json()) as Array<Pick<SyncRow, "payload" | "updated_at">>;
  const row = rows[0];

  return NextResponse.json({
    enabled: true,
    payload: row?.payload ?? null,
    updatedAt: row?.updated_at ?? null,
  });
}

export async function POST(request: Request) {
  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json({ enabled: false }, { status: 503 });
  }

  const payload = await request.json();

  const response = await fetch(
    `${config.url}/rest/v1/app_state?on_conflict=id`,
    {
      method: "POST",
      headers: {
        ...getHeaders(config.serviceRoleKey),
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        id: SYNC_ROW_ID,
        payload,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json({ enabled: true, message }, { status: 502 });
  }

  return NextResponse.json({ enabled: true, ok: true });
}
