import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getAllCamps, createCamp } from "@/lib/camps";

export async function GET(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cityId = request.nextUrl.searchParams.get("cityId") ?? undefined;
  return NextResponse.json({ camps: await getAllCamps(cityId) });
}

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { name, description, visibility, ownerId, ownerName, cityId } = await request.json();
  if (!name?.trim() || !ownerId) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const camp = await createCamp({
    name: name.trim(), description: description?.trim(),
    visibility: visibility ?? "public", ownerId, ownerName: ownerName ?? "用户", cityId,
  });
  return NextResponse.json({ camp });
}
