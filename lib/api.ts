"use client";

import type {
  PlazaUser, PlazaPostWithReactions, City, ReactionType, PostReactions,
  UserSkill, UserItem, UserTask, ItemCategory, TaskStatus, UserSearchParams,
  Transaction, CheckinResult, LeaderboardType,
  UserEvent, EventComment,
  Camp, CampVisibility, CampFollow, UserFriend,
} from "./types";

// ============ 通用 ============

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

async function put<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${url} → ${res.status}`);
  return res.json();
}

async function del<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DELETE ${url} → ${res.status}`);
  return res.json();
}

// ============ 用户 ============

export async function fetchCurrentUser() {
  const d = await get<{ user?: Record<string, string> }>("/api/secondme/user");
  return d.user ?? null;
}

export async function fetchPlazaUsers(): Promise<PlazaUser[]> {
  return (await get<{ users: PlazaUser[] }>("/api/plaza/users")).users;
}

export async function searchUsers(params: UserSearchParams): Promise<PlazaUser[]> {
  const qs = new URLSearchParams();
  if (params.name) qs.set("name", params.name);
  if (params.occupation) qs.set("occupation", params.occupation);
  if (params.description) qs.set("description", params.description);
  if (params.cityId) qs.set("cityId", params.cityId);
  if (params.limit) qs.set("limit", String(params.limit));
  return (await get<{ users: PlazaUser[] }>(`/api/plaza/users/search?${qs}`)).users;
}

export async function updateProfile(userId: string, data: {
  name?: string; occupation?: string; description?: string; walletAddress?: string;
}): Promise<PlazaUser> {
  return (await put<{ user: PlazaUser }>("/api/profile/update", { userId, ...data })).user;
}

// ============ 帖子 ============

export async function fetchPosts(userId?: string, campId?: string): Promise<PlazaPostWithReactions[]> {
  const params = new URLSearchParams();
  if (userId) params.set("userId", userId);
  if (campId) params.set("campId", campId);
  const qs = params.toString();
  return (await get<{ posts: PlazaPostWithReactions[] }>(`/api/plaza/posts${qs ? `?${qs}` : ""}`)).posts;
}

export async function createPost(body: {
  userId: string; userName: string; userAvatar: string | null; campId?: string; content: string;
}) {
  return post<{ post: PlazaPostWithReactions }>("/api/plaza/posts", body);
}

export async function reactToPost(postId: string, userId: string, action: ReactionType): Promise<PostReactions> {
  return post<PostReactions>(`/api/plaza/posts/${postId}/react`, { userId, action });
}

// ============ 城市 ============

export async function fetchCities(): Promise<City[]> {
  return (await get<{ cities: City[] }>("/api/plaza/cities")).cities;
}

export async function proposeCity(body: {
  name: string; description?: string; color?: string; icon?: string; creatorId: string;
}) {
  return post<{ city: City }>("/api/plaza/cities", body);
}

export async function voteCity(cityId: string, userId: string) {
  return post<{ city: City; activated: boolean }>(`/api/plaza/cities/${cityId}/vote`, { userId });
}

// 兼容旧接口
export const fetchZones = fetchCities;
export const proposeZone = proposeCity;
export const voteZone = voteCity;

// ============ 技能 ============

export async function fetchSkills(userId: string): Promise<UserSkill[]> {
  return (await get<{ skills: UserSkill[] }>(`/api/profile/skills?userId=${userId}`)).skills;
}

export async function addSkill(userId: string, name: string, description?: string): Promise<UserSkill> {
  return (await post<{ skill: UserSkill }>("/api/profile/skills", { userId, name, description })).skill;
}

export async function removeSkill(skillId: string, userId: string): Promise<void> {
  await del("/api/profile/skills", { skillId, userId });
}

// ============ 商品 ============

export async function fetchUserItems(userId: string): Promise<UserItem[]> {
  return (await get<{ items: UserItem[] }>(`/api/profile/items?userId=${userId}`)).items;
}

export async function fetchMarketItems(category?: ItemCategory): Promise<UserItem[]> {
  const qs = category ? `?market=true&category=${category}` : "?market=true";
  return (await get<{ items: UserItem[] }>(`/api/profile/items${qs}`)).items;
}

export async function createItem(body: {
  userId: string; name: string; description?: string;
  category: ItemCategory; price: number; tokenSymbol?: string;
}): Promise<UserItem> {
  return (await post<{ item: UserItem }>("/api/profile/items", body)).item;
}

export async function buyItem(itemId: string, buyerId: string, txHash?: string): Promise<UserItem> {
  return (await post<{ item: UserItem }>("/api/profile/items", { action: "buy", itemId, buyerId, txHash })).item;
}

// ============ 任务 ============

export async function fetchUserTasks(userId: string): Promise<UserTask[]> {
  return (await get<{ tasks: UserTask[] }>(`/api/profile/tasks?userId=${userId}`)).tasks;
}

export async function fetchOpenTasks(): Promise<UserTask[]> {
  return (await get<{ tasks: UserTask[] }>("/api/profile/tasks?open=true")).tasks;
}

export async function createTask(body: {
  userId: string; title: string; description?: string;
  reward: number; tokenSymbol?: string;
}): Promise<UserTask> {
  return (await post<{ task: UserTask }>("/api/profile/tasks", body)).task;
}

export async function updateTaskStatus(taskId: string, userId: string, status: TaskStatus, assigneeId?: string): Promise<void> {
  await post("/api/profile/tasks", { action: "updateStatus", taskId, userId, status, assigneeId });
}

// ============ 经济系统 ============

export async function fetchTransactions(userId: string): Promise<Transaction[]> {
  return (await get<{ transactions: Transaction[] }>(`/api/profile/transactions?userId=${userId}`)).transactions;
}

export async function doCheckin(userId: string): Promise<CheckinResult> {
  return post<CheckinResult>("/api/checkin", { userId });
}

export async function fetchLeaderboard(type: LeaderboardType): Promise<PlazaUser[]> {
  return (await get<{ users: PlazaUser[] }>(`/api/leaderboard?type=${type}`)).users;
}

export async function boostTarget(userId: string, targetType: "post" | "item", targetId: string, computeAmount: number): Promise<void> {
  await post("/api/boost", { userId, targetType, targetId, computeAmount });
}

// ============ 事件系统 ============

export async function fetchUserEvents(userId: string, limit = 50): Promise<UserEvent[]> {
  return (await get<{ events: UserEvent[] }>(`/api/events?userId=${userId}&limit=${limit}`)).events;
}

export async function fetchAllEvents(limit = 100): Promise<UserEvent[]> {
  return (await get<{ events: UserEvent[] }>(`/api/events?limit=${limit}`)).events;
}

export async function voteEvent(eventId: string, userId: string, vote: "like" | "dislike") {
  return post<{ likes: number; dislikes: number; userVote: string | null }>(
    `/api/events/${eventId}/vote`, { userId, vote }
  );
}

export async function fetchEventComments(eventId: string): Promise<EventComment[]> {
  return (await get<{ comments: EventComment[] }>(`/api/events/${eventId}/comments`)).comments;
}

export async function addEventComment(eventId: string, userId: string, userName: string, content: string): Promise<EventComment> {
  return (await post<{ comment: EventComment }>(`/api/events/${eventId}/comments`, { userId, userName, content })).comment;
}

// ============ 营地 ============

export async function fetchCamps(cityId?: string): Promise<Camp[]> {
  const qs = cityId ? `?cityId=${cityId}` : "";
  return (await get<{ camps: Camp[] }>(`/api/camps${qs}`)).camps;
}

export async function createCamp(body: {
  name: string; description?: string; visibility: CampVisibility;
  ownerId: string; ownerName: string;
}): Promise<Camp> {
  return (await post<{ camp: Camp }>("/api/camps", body)).camp;
}

export async function joinCamp(campId: string, userId: string, userName: string) {
  return post<{ joined: boolean; needApproval: boolean }>(`/api/camps/${campId}/join`, { userId, userName });
}

export async function followCamp(userId: string, campId: string) {
  return post<{ ok: boolean }>("/api/camps/follow", { userId, campId });
}

export async function unfollowCamp(userId: string, campId: string) {
  return post<{ ok: boolean }>("/api/camps/follow", { userId, campId, action: "unfollow" });
}

export async function fetchFollowedCamps(userId: string): Promise<CampFollow[]> {
  return (await get<{ follows: CampFollow[] }>(`/api/camps/follow?userId=${userId}`)).follows;
}

// ============ 好友 ============

export async function fetchFriends(userId: string): Promise<UserFriend[]> {
  return (await get<{ friends: UserFriend[] }>(`/api/friends?userId=${userId}`)).friends;
}

export async function addFriend(userId: string, friendId: string) {
  return post<{ ok: boolean }>("/api/friends", { userId, friendId });
}

export async function removeFriend(userId: string, friendId: string) {
  return post<{ ok: boolean }>("/api/friends", { userId, friendId, action: "remove" });
}
