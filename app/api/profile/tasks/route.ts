import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getUserTasks, createTask, updateTaskStatus, getOpenTasks } from "@/lib/profile";
import { transferCoins, addReputation } from "@/lib/economy";

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

  // 完成任务：转账奖励
  if (body.action === "updateStatus") {
    await updateTaskStatus(body.taskId, body.userId, body.status, body.assigneeId);

    // 任务完成时发放奖励
    if (body.status === "completed" && body.assigneeId) {
      const tasks = await getUserTasks(body.userId);
      const task = tasks.find((t) => t.id === body.taskId);
      if (task && task.reward > 0) {
        const ok = await transferCoins(body.userId, body.assigneeId, task.reward, "task_reward", task.id);
        if (ok) {
          // 执行者 +8 信誉，发布者 +2 信誉
          addReputation(body.assigneeId, 8, "task_done", task.id).catch(() => {});
          addReputation(body.userId, 2, "task_published", task.id).catch(() => {});
        }
      }
    }
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
