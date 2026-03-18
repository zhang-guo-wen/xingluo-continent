import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";

export async function POST() {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
