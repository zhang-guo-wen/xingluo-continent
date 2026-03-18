import { Redis } from "@upstash/redis";

export type { ReactionType, PostReactions } from "./types";
import type { ReactionType, PostReactions } from "./types";

// ============ Redis（生产） ============

const UPSTASH_URL = process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;

function getRedis(): Redis | null {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  return new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
}

// ============ 内存回退（本地开发） ============

const memLikes = new Map<string, Set<string>>();
const memDislikes = new Map<string, Set<string>>();

function getLikeSet(postId: string): Set<string> {
  if (!memLikes.has(postId)) memLikes.set(postId, new Set());
  return memLikes.get(postId)!;
}

function getDislikeSet(postId: string): Set<string> {
  if (!memDislikes.has(postId)) memDislikes.set(postId, new Set());
  return memDislikes.get(postId)!;
}

// ============ 导出函数 ============

/**
 * 切换反应：点赞/点踩。再次点击同类型则取消。
 * 返回更新后的状态。
 */
export async function toggleReaction(
  postId: string,
  userId: string,
  action: ReactionType
): Promise<PostReactions> {
  const redis = getRedis();
  const likeKey = `post:${postId}:likes`;
  const dislikeKey = `post:${postId}:dislikes`;

  if (redis) {
    const oppositeKey = action === "like" ? dislikeKey : likeKey;
    const targetKey = action === "like" ? likeKey : dislikeKey;

    // 移除对立反应
    await redis.srem(oppositeKey, userId);

    // 切换当前反应
    const isMember = await redis.sismember(targetKey, userId);
    if (isMember) {
      await redis.srem(targetKey, userId);
    } else {
      await redis.sadd(targetKey, userId);
    }

    const [likes, dislikes, hasLike, hasDislike] = await Promise.all([
      redis.scard(likeKey),
      redis.scard(dislikeKey),
      redis.sismember(likeKey, userId),
      redis.sismember(dislikeKey, userId),
    ]);

    return {
      likes,
      dislikes,
      userReaction: hasLike ? "like" : hasDislike ? "dislike" : null,
    };
  }

  // 内存回退
  const likes = getLikeSet(postId);
  const dislikes = getDislikeSet(postId);
  const oppositeSet = action === "like" ? dislikes : likes;
  const targetSet = action === "like" ? likes : dislikes;

  oppositeSet.delete(userId);
  if (targetSet.has(userId)) {
    targetSet.delete(userId);
  } else {
    targetSet.add(userId);
  }

  return {
    likes: likes.size,
    dislikes: dislikes.size,
    userReaction: likes.has(userId) ? "like" : dislikes.has(userId) ? "dislike" : null,
  };
}

/** 批量获取多个帖子的反应数据 */
export async function getPostsReactions(
  postIds: string[],
  userId?: string
): Promise<Record<string, PostReactions>> {
  if (postIds.length === 0) return {};

  const redis = getRedis();
  const result: Record<string, PostReactions> = {};

  if (redis) {
    const pipeline = redis.pipeline();
    for (const pid of postIds) {
      pipeline.scard(`post:${pid}:likes`);
      pipeline.scard(`post:${pid}:dislikes`);
      if (userId) {
        pipeline.sismember(`post:${pid}:likes`, userId);
        pipeline.sismember(`post:${pid}:dislikes`, userId);
      }
    }
    const responses = await pipeline.exec();
    const step = userId ? 4 : 2;

    for (let i = 0; i < postIds.length; i++) {
      const base = i * step;
      result[postIds[i]] = {
        likes: (responses[base] as number) ?? 0,
        dislikes: (responses[base + 1] as number) ?? 0,
        userReaction: userId
          ? responses[base + 2]
            ? "like"
            : responses[base + 3]
              ? "dislike"
              : null
          : null,
      };
    }
    return result;
  }

  // 内存回退
  for (const pid of postIds) {
    const likes = getLikeSet(pid);
    const dislikes = getDislikeSet(pid);
    result[pid] = {
      likes: likes.size,
      dislikes: dislikes.size,
      userReaction: userId
        ? likes.has(userId)
          ? "like"
          : dislikes.has(userId)
            ? "dislike"
            : null
        : null,
    };
  }
  return result;
}
