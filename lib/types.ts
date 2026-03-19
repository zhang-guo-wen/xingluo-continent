// ============ 用户 ============

export interface PlazaUser {
  id: string;
  userNo: string;           // XL-000001
  name: string;
  occupation: string | null;
  description: string | null;
  avatarUrl: string | null;
  route: string | null;
  walletAddress: string | null;
  cityId: string;           // 所属城市
  campId: string | null;    // 所属营地 ID（null=未分配）
  isOnline: boolean;        // 是否在线
  lastSeenAt: string | null; // 最后在线时间
  reputation: number;
  coins: number;
  compute: number;
  joinedAt: string;
}

// ============ 营地 ============

export type CampVisibility = "public" | "private";

export interface Camp {
  id: string;
  name: string;
  description: string | null;
  visibility: CampVisibility;  // public=公开, private=私人（需申请）
  ownerId: string;
  ownerName: string;
  capacity: number;            // 默认 256
  memberCount: number;
  cityId: string;
  createdAt: string;
}

export interface CampJoinRequest {
  id: string;
  campId: string;
  userId: string;
  userName: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
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

// ============ 交易流水 ============

export type TxType = "mint" | "trade" | "task_reward" | "like_reward" | "checkin" | "boost" | "signup_bonus";

export interface Transaction {
  id: string;
  fromUserId: string | null;  // null = 系统铸造
  toUserId: string | null;    // null = 销毁
  amount: number;
  type: TxType;
  refId: string | null;
  memo: string | null;
  createdAt: string;
}

// ============ 算力加速 ============

export interface ComputeBoost {
  id: string;
  userId: string;
  targetType: "post" | "item";
  targetId: string;
  computeSpent: number;
  boostScore: number;
  createdAt: string;
}

// ============ 价格历史 ============

export interface PricePoint {
  price: number;
  recordedAt: string;
}

// ============ 排行榜 ============

export type LeaderboardType = "reputation" | "coins" | "compute";

// ============ 签到 ============

export interface CheckinResult {
  alreadyDone: boolean;
  coinReward: number;
  computeReward: number;
}

// ============ 事件系统（防篡改） ============

export type EventAction =
  | "register" | "update_name" | "update_occupation" | "update_description" | "update_wallet"
  | "add_skill" | "remove_skill"
  | "create_post" | "like_post" | "unlike_post" | "dislike_post" | "undislike_post"
  | "list_item" | "buy_item" | "remove_item"
  | "create_task" | "complete_task" | "cancel_task"
  | "checkin" | "boost" | "propose_city" | "vote_city";

export interface UserEvent {
  id: string;
  userId: string;
  userName: string;
  action: EventAction;
  detail: string;         // 人类可读的描述
  refId: string | null;   // 关联对象 ID
  hash: string;           // SHA256(prevHash + action + detail + timestamp) 防篡改链
  prevHash: string;       // 上一条事件的 hash
  likes: number;
  dislikes: number;
  createdAt: string;
}

export interface EventComment {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  content: string;
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
