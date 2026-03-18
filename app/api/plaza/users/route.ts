import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getAllPlazaUsers } from "@/lib/db";

export async function GET() {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ users: await getAllPlazaUsers() });
}
