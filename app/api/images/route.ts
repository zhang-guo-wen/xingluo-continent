import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { uploadImage } from "@/lib/images";

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const userId = formData.get("userId") as string | null;

  if (!file || !userId) return NextResponse.json({ error: "缺少文件或 userId" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "只支持图片" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "图片最大 5MB" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const imageId = await uploadImage(userId, buffer, file.type);

  return NextResponse.json({ imageId, url: `/api/images/${imageId}` });
}
