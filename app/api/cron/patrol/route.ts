import { NextRequest, NextResponse } from "next/server";
import { getAllPosts, getAllPlazaUsers } from "@/lib/db";
import { getPostsReactions } from "@/lib/kv";
import { getPostComments, addAppealComment, addComment } from "@/lib/comments";
import { addReputation } from "@/lib/economy";
import { toggleReaction } from "@/lib/kv";

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET ?? "xingluo-patrol";

// Agent 名字池
const AGENT_NAMES = [
  "星罗审查员α", "知识验证官β", "实践鉴定师γ",
  "信息巡逻兵δ", "质量守卫者ε", "真理探索者ζ",
  "逻辑校验员η", "知识评审官θ", "事实核查师ι", "智慧巡查员κ",
];

/** 调用 MiniMax API */
async function callMiniMax(prompt: string): Promise<string | null> {
  if (!MINIMAX_API_KEY) return null;
  try {
    const res = await fetch("https://api.minimax.chat/v1/text/chatcompletion_v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({
        model: "MiniMax-Text-01",
        messages: [
          { role: "system", content: "你是星罗大陆的 AI 知识审查员。你的职责是评估帖子中知识的真实性和实用性。回复简洁，不超过100字。" },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
      }),
    });
    const data = await res.json();
    // 兼容两种返回格式
    if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
    if (data.reply) return data.reply;
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  // 简单鉴权
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allUsers = await getAllPlazaUsers();
  const allPosts = await getAllPosts();

  if (allPosts.length === 0 || allUsers.length === 0) {
    return NextResponse.json({ message: "无帖子或用户" });
  }

  // Agent 数量 = 用户数 * 10%，至少1个，最多10个
  const agentCount = Math.min(10, Math.max(1, Math.floor(allUsers.length * 0.1)));

  // 过滤已巡查过的帖子（有「AI 巡查评审」标记的评论则跳过）
  const reviewedPostIds = new Set<string>();
  for (const post of allPosts) {
    const comments = await getPostComments(post.id);
    if (comments.some((c) => c.content.includes("AI 巡查评审"))) {
      reviewedPostIds.add(post.id);
    }
  }

  // 只审查未巡查过的帖子
  const unreviewed = allPosts.filter((p) => !reviewedPostIds.has(p.id));
  const shuffledPosts = [...unreviewed].sort(() => Math.random() - 0.5);
  const postsToReview = shuffledPosts.slice(0, agentCount);

  const results: { agent: string; postId: string; action: string }[] = [];

  for (let i = 0; i < postsToReview.length; i++) {
    const post = postsToReview[i];
    const agentName = AGENT_NAMES[i % AGENT_NAMES.length];
    const agentId = `agent_${agentName}`;

    // 确保 agent 用户存在
    const existingAgent = allUsers.find((u) => u.id === agentId);
    if (!existingAgent) {
      // 跳过，agent 用户需要预先创建
      // 这里简单用 addComment 的方式参与
    }

    // 截取帖子前300字让 AI 评估
    const excerpt = post.content.slice(0, 300);
    const prompt = `评估这篇知识帖子的质量和真实性，帖子标签是 ${(post.tags ?? []).join("/")}，来源是 ${post.source}：\n\n${excerpt}\n\n请简短评价（50字内），并在最后一行回复：LIKE 或 DISLIKE 或 SKIP`;

    const aiResponse = await callMiniMax(prompt);

    if (!aiResponse) {
      results.push({ agent: agentName, postId: post.id, action: "skip_api_error" });
      continue;
    }

    const lines = aiResponse.trim().split("\n");
    const lastLine = lines[lines.length - 1].toUpperCase().trim();
    const comment = lines.slice(0, -1).join(" ").trim() || aiResponse.trim();

    // 发表评论
    await addComment(post.id, agentId, agentName, `🤖 AI 巡查评审：${comment}`);

    if (lastLine.includes("LIKE")) {
      // 给 agent 加 1 信誉用于投票（系统赋予）
      await addReputation(agentId, 1, "patrol_grant", post.id);
      await toggleReaction(post.id, agentId, "like");
      await addReputation(agentId, -1, "react_cost", post.id);
      // 作者 +1 信誉
      await addReputation(post.userId, 1, "post_liked", post.id);
      results.push({ agent: agentName, postId: post.id, action: "like" });
    } else if (lastLine.includes("DISLIKE")) {
      await addReputation(agentId, 1, "patrol_grant", post.id);
      await toggleReaction(post.id, agentId, "dislike");
      await addReputation(agentId, -1, "react_cost", post.id);
      await addReputation(post.userId, -1, "post_disliked", post.id);
      results.push({ agent: agentName, postId: post.id, action: "dislike" });
    } else {
      results.push({ agent: agentName, postId: post.id, action: "skip" });
    }
  }

  return NextResponse.json({
    message: `巡查完成，${agentCount} 个 Agent 审查了 ${postsToReview.length} 篇帖子`,
    results,
  });
}
