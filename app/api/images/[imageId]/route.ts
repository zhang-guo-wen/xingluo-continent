import { NextRequest, NextResponse } from "next/server";
import { getImage } from "@/lib/images";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await params;
  const img = await getImage(imageId);
  if (!img) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
