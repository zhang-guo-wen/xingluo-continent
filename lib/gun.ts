"use client";

import Gun from "gun/gun";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GunAny = any;

let gunInstance: GunAny = null;

export function getGun(): GunAny {
  if (typeof window === "undefined") return null;
  if (!gunInstance) {
    gunInstance = (Gun as GunAny)({
      peers: ["https://gun-manhattan.herokuapp.com/gun"],
      localStorage: true,
    });
  }
  return gunInstance;
}

// 频道设计：帖子只在营地内分发（最多 256 人）
//   xingluo/camp/{campId}/posts — 营地频道

export interface GunPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  campId: string;
  content: string;
  createdAt: string;
}

function campKey(campId: string) { return `xingluo/camp/${campId}/posts`; }

/** 发布帖子到营地频道 */
export function gunPublishPost(post: GunPost) {
  const gun = getGun();
  if (!gun) return;
  gun.get(campKey(post.campId)).get(post.id).put({
    id: post.id, userId: post.userId, userName: post.userName,
    userAvatar: post.userAvatar ?? "", campId: post.campId,
    content: post.content, createdAt: post.createdAt,
  });
}

/** 订阅营地帖子 */
export function gunSubscribePosts(
  campId: string,
  callback: (post: GunPost) => void
): () => void {
  const gun = getGun();
  if (!gun) return () => {};

  const ref = gun.get(campKey(campId)).map().on((data: GunAny) => {
    if (!data || !data.id || !data.content) return;
    callback({
      id: data.id, userId: data.userId, userName: data.userName,
      userAvatar: data.userAvatar || null, campId: data.campId ?? campId,
      content: data.content, createdAt: data.createdAt,
    });
  });

  return () => { try { ref.off?.(); } catch {} };
}
