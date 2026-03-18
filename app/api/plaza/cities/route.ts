import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getAllCities, proposeCity } from "@/lib/cities";

export async function GET() {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ cities: await getAllCities() });
}

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name, description, color, icon, creatorId } = await request.json();
  if (!name?.trim() || !creatorId) {
    return NextResponse.json({ error: "名称和创建者不能为空" }, { status: 400 });
  }

  const city = await proposeCity({ name: name.trim(), description: description?.trim(), color, icon, creatorId });
  return NextResponse.json({ city });
}
