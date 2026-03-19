import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getCampRequests, handleJoinRequest } from "@/lib/camps";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ campId: string }> }
) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { campId } = await params;
  return NextResponse.json({ requests: await getCampRequests(campId) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campId: string }> }
) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await params; // consume params
  const { requestId, ownerId, approve } = await request.json();
  const ok = await handleJoinRequest(requestId, ownerId, approve);
  return NextResponse.json({ ok });
}
