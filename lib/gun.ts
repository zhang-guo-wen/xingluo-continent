"use client";

import Gun from "gun/gun";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GunAny = any;

// Gun 实例（客户端单例）
let gunInstance: GunAny = null;

export function getGun(): GunAny {
  if (typeof window === "undefined") return null;
  if (!gunInstance) {
    gunInstance = (Gun as GunAny)({
      peers: [
        "https://gun-manhattan.herokuapp.com/gun",
      ],
      localStorage: true,
    });
  }
  return gunInstance;
}

// ============ 帖子命名空间 ============

const POSTS_KEY = "xingluo/posts";

export interface GunPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  createdAt: string;
}

/** 发布帖子到 Gun 网络 */
export function gunPublishPost(post: GunPost) {
  const gun = getGun();
  if (!gun) return;
  gun.get(POSTS_KEY).get(post.id).put({
    id: post.id,
    userId: post.userId,
    userName: post.userName,
    userAvatar: post.userAvatar ?? "",
    content: post.content,
    createdAt: post.createdAt,
  });
}

/** 监听帖子实时更新 */
export function gunSubscribePosts(
  callback: (post: GunPost) => void
): () => void {
  const gun = getGun();
  if (!gun) return () => {};

  const ref = gun.get(POSTS_KEY);
  const handler = ref.map().on((data: GunAny) => {
    if (!data || !data.id || !data.content) return;
    callback({
      id: data.id,
      userId: data.userId,
      userName: data.userName,
      userAvatar: data.userAvatar || null,
      content: data.content,
      createdAt: data.createdAt,
    });
  });

  return () => {
    try { handler.off?.(); } catch {}
  };
}
