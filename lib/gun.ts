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

// ============ 频道设计 ============
//
// Gun 命名空间按作用域隔离：
//   xingluo/camp/{campId}/posts  — 营地内帖子（只有同营地成员实时收到）
//   xingluo/city/{cityId}/posts  — 城市广播（同城所有人收到）
//   xingluo/world/posts          — 全服广播（所有人收到，仅重要公告）
//
// 用户发帖时：写入自己营地频道 + 城市频道
// 用户订阅时：订阅自己营地频道 + 城市频道

export interface GunPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  campId: string;
  cityId: string;
  content: string;
  createdAt: string;
}

function campKey(campId: string) { return `xingluo/camp/${campId}/posts`; }
function cityKey(cityId: string) { return `xingluo/city/${cityId}/posts`; }

/** 发布帖子：写入营地频道 + 城市频道 */
export function gunPublishPost(post: GunPost) {
  const gun = getGun();
  if (!gun) return;
  const data = {
    id: post.id, userId: post.userId, userName: post.userName,
    userAvatar: post.userAvatar ?? "", campId: post.campId,
    cityId: post.cityId, content: post.content, createdAt: post.createdAt,
  };
  // 写入营地频道
  gun.get(campKey(post.campId)).get(post.id).put(data);
  // 写入城市频道
  gun.get(cityKey(post.cityId)).get(post.id).put(data);
}

/** 订阅帖子：监听营地频道 + 城市频道 */
export function gunSubscribePosts(
  campId: string,
  cityId: string,
  callback: (post: GunPost) => void
): () => void {
  const gun = getGun();
  if (!gun) return () => {};

  const seen = new Set<string>();
  function handle(data: GunAny) {
    if (!data || !data.id || !data.content) return;
    if (seen.has(data.id)) return; // 去重（同一帖子可能从营地和城市两个频道收到）
    seen.add(data.id);
    callback({
      id: data.id, userId: data.userId, userName: data.userName,
      userAvatar: data.userAvatar || null, campId: data.campId ?? campId,
      cityId: data.cityId ?? cityId, content: data.content, createdAt: data.createdAt,
    });
  }

  // 订阅营地频道
  const campRef = gun.get(campKey(campId)).map().on(handle);
  // 订阅城市频道
  const cityRef = gun.get(cityKey(cityId)).map().on(handle);

  return () => {
    try { campRef.off?.(); } catch {}
    try { cityRef.off?.(); } catch {}
  };
}
