// ============ 用户 ============

export interface PlazaUser {
  id: string;
  userNo: string;
  name: string;
  occupation: string | null;
  description: string | null;
  avatarUrl: string | null;
  route: string | null;
  reputation: number;
  coins: number;
  joinedAt: string;
}

// ============ 帖子 ============

export interface PlazaPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  createdAt: string;
}

/** 前端用：帖子 + 反应数据 */
export interface PlazaPostWithReactions extends PlazaPost {
  likes: number;
  dislikes: number;
  userReaction: ReactionType | null;
}

// ============ 反应 ============

export type ReactionType = "like" | "dislike";

export interface PostReactions {
  likes: number;
  dislikes: number;
  userReaction: ReactionType | null;
}

// ============ 区域 ============

export interface Zone {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  creatorId: string;
  status: "voting" | "active" | "archived";
  voteDeadline: string | null;
  approveCount: number;
  rejectCount: number;
  createdAt: string;
}

export interface ZoneVote {
  id: string;
  zoneId: string;
  userId: string;
  vote: "approve" | "reject";
  createdAt: string;
}

// ============ 认证 ============

export interface SecondMeUserInfo {
  id: string;
  name: string;
  nickname?: string;
  email?: string;
  avatarUrl: string | null;
  route: string | null;
}

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
}
