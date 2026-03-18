import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getAllZones, proposeZone } from "@/lib/zones";

export async function GET() {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ zones: await getAllZones() });
}

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, color, icon, creatorId } = body;

  if (!name?.trim() || !creatorId) {
    return NextResponse.json({ error: "名称和创建者 ID 不能为空" }, { status: 400 });
  }

  const zone = await proposeZone({
    name: name.trim(),
    description: description?.trim(),
    color,
    icon,
    creatorId,
  });

  return NextResponse.json({ zone });
}
