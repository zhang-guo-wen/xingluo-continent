import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getUserTasks, createTask, updateTaskStatus, getOpenTasks } from "@/lib/profile";

export async function GET(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const userId = sp.get("userId");
  const open = sp.get("open");

  if (open === "true") return NextResponse.json({ tasks: await getOpenTasks() });
  if (!userId) return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
  return NextResponse.json({ tasks: await getUserTasks(userId) });
}

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();

  // 更新状态
  if (body.action === "updateStatus") {
    await updateTaskStatus(body.taskId, body.userId, body.status, body.assigneeId);
    return NextResponse.json({ ok: true });
  }

  // 发布任务
  const { userId, title, description, reward, tokenSymbol } = body;
  if (!userId || !title?.trim()) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const task = await createTask({
    userId, title: title.trim(), description: description?.trim(),
    reward: reward ?? 0, tokenSymbol,
  });
  return NextResponse.json({ task });
}
