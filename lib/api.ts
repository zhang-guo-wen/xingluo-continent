"use client";

import type {
  PlazaUser,
  PlazaPostWithReactions,
  Zone,
  ReactionType,
  PostReactions,
} from "./types";

// ============ 通用请求 ============

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json();
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);
  return res.json();
}

// ============ 用户 ============

export async function fetchCurrentUser() {
  const d = await get<{ user?: Record<string, string> }>("/api/secondme/user");
  return d.user ?? null;
}

export async function fetchPlazaUsers(): Promise<PlazaUser[]> {
  const d = await get<{ users: PlazaUser[] }>("/api/plaza/users");
  return d.users;
}

// ============ 帖子 ============

export async function fetchPosts(userId?: string): Promise<PlazaPostWithReactions[]> {
  const qs = userId ? `?userId=${userId}` : "";
  const d = await get<{ posts: PlazaPostWithReactions[] }>(`/api/plaza/posts${qs}`);
  return d.posts;
}

export async function createPost(body: {
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
}) {
  return post<{ post: PlazaPostWithReactions }>("/api/plaza/posts", body);
}

export async function reactToPost(
  postId: string,
  userId: string,
  action: ReactionType
): Promise<PostReactions> {
  return post<PostReactions>(`/api/plaza/posts/${postId}/react`, { userId, action });
}

// ============ 区域 ============

export async function fetchZones(): Promise<Zone[]> {
  const d = await get<{ zones: Zone[] }>("/api/plaza/zones");
  return d.zones;
}

export async function proposeZone(body: {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  creatorId: string;
}) {
  return post<{ zone: Zone }>("/api/plaza/zones", body);
}

export async function voteZone(
  zoneId: string,
  userId: string,
  vote: "approve" | "reject"
) {
  return post<{ zone: Zone; activated: boolean }>(
    `/api/plaza/zones/${zoneId}/vote`,
    { userId, vote }
  );
}
