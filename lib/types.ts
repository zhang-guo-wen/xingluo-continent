// ============ 用户 ============

export interface PlazaUser {
  id: string;
  userNo: string;           // XL-000001
  name: string;
  occupation: string | null;
  description: string | null;
  avatarUrl: string | null;
  route: string | null;
  walletAddress: string | null; // Web3 钱包地址
  cityId: string;           // 所属城市
  reputation: number;
  coins: number;
  joinedAt: string;
}

// ============ 城市 ============

export interface City {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  // 银河系坐标
  galaxyX: number;
  galaxyY: number;
  galaxyZ: number;
  // 地图网格位置
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  capacity: number;         // 最大容量，默认 1000000
  population: number;       // 当前人口
  creatorId: string;
  status: "voting" | "active" | "archived";
  voteCount: number;        // 支持票数
  voteThreshold: number;    // 通过门槛，默认 10000
  createdAt: string;
}

export interface CityVote {
  id: string;
  cityId: string;
  userId: string;
  createdAt: string;
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

// ============ 技能 ============

export interface UserSkill {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
}

// ============ 商品（Web3 交易） ============

export type ItemStatus = "on_sale" | "sold" | "removed";
export type ItemCategory = "goods" | "info" | "service" | "compute";

export interface UserItem {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  category: ItemCategory;   // 物品/信息/服务/算力
  price: number;            // 价格（Token）
  tokenSymbol: string;      // 代币符号，默认 "XLC"（星罗币）
  status: ItemStatus;
  buyerId: string | null;
  txHash: string | null;    // Web3 交易哈希
  createdAt: string;
}

// ============ 任务 ============

export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";

export interface UserTask {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  reward: number;           // 悬赏金额
  tokenSymbol: string;
  status: TaskStatus;
  assigneeId: string | null;
  createdAt: string;
}

// ============ 信誉评审 ============

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface ReputationReview {
  id: string;
  userId: string;
  reason: string;           // 申请理由
  aiVotes: number;          // AI 赞成数（共 10 个 AI 评审）
  aiTotal: number;          // 固定 10
  rewardPoints: number;     // 通过后获得的信誉分
  status: ReviewStatus;
  createdAt: string;
}

// ============ 搜索 ============

export interface UserSearchParams {
  name?: string;
  occupation?: string;
  description?: string;
  cityId?: string;
  limit?: number;
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

// ============ 兼容旧代码（逐步迁移） ============

/** @deprecated 使用 City */
export type Zone = City;
/** @deprecated 使用 CityVote */
export type ZoneVote = CityVote;
