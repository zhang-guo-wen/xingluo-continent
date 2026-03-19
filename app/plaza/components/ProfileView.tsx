"use client";

import { useEffect, useState } from "react";
import type { PlazaUser, PlazaPostWithReactions, UserSkill, UserItem, UserTask, Transaction } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import * as api from "@/lib/api";
import PixelAvatar from "./PixelAvatar";
import EditProfileModal from "./modals/EditProfileModal";
import SkillModal from "./modals/SkillModal";
import ItemModal from "./modals/ItemModal";
import TaskModal from "./modals/TaskModal";

type ProfileTab = "skills" | "posts" | "items" | "tasks" | "ledger";

const TABS: { key: ProfileTab; icon: string; label: string }[] = [
  { key: "skills", icon: "🎯", label: "技能" },
  { key: "posts", icon: "📝", label: "消息" },
  { key: "items", icon: "🏪", label: "商品" },
  { key: "tasks", icon: "📋", label: "任务" },
  { key: "ledger", icon: "📒", label: "账单" },
];

const TX_TYPE_LABEL: Record<string, string> = {
  mint: "系统铸造", trade: "交易", task_reward: "任务奖励",
  like_reward: "点赞奖励", checkin: "签到", boost: "加速", signup_bonus: "注册奖励",
};

const CATEGORY_LABEL: Record<string, string> = {
  goods: "📦 物品", info: "📄 信息", service: "🛠️ 服务", compute: "⚡ 算力",
};

const STATUS_LABEL: Record<string, string> = {
  on_sale: "🟢 在售", sold: "🔴 已售", removed: "⚫ 下架",
  open: "🟢 开放", in_progress: "🟡 进行中", completed: "✅ 完成", cancelled: "⚫ 取消",
};

interface Props {
  user: PlazaUser;
  onUserUpdate?: (user: PlazaUser) => void;
}

export default function ProfileView({ user, onUserUpdate }: Props) {
  const [tab, setTab] = useState<ProfileTab>("skills");
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [posts, setPosts] = useState<PlazaPostWithReactions[]>([]);
  const [items, setItems] = useState<UserItem[]>([]);
  const [tasks, setTasks] = useState<UserTask[]>([]);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [checkinDone, setCheckinDone] = useState(false);

  useEffect(() => {
    if (!user.id) return;
    api.fetchSkills(user.id).then(setSkills).catch(() => {});
    api.fetchPosts(user.id).then((all) => setPosts(all.filter((p) => p.userId === user.id))).catch(() => {});
    api.fetchUserItems(user.id).then(setItems).catch(() => {});
    api.fetchUserTasks(user.id).then(setTasks).catch(() => {});
    api.fetchTransactions(user.id).then(setTransactions).catch(() => {});
  }, [user.id]);

  async function handleEditProfile(data: { name: string; occupation: string; description: string; walletAddress: string }) {
    const updated = await api.updateProfile(user.id, data);
    setShowEditProfile(false);
    onUserUpdate?.(updated);
  }

  async function handleAddSkill(name: string, description?: string) {
    const skill = await api.addSkill(user.id, name, description);
    setSkills((prev) => [skill, ...prev]);
    setShowSkillModal(false);
  }

  async function handleRemoveSkill(skillId: string) {
    await api.removeSkill(skillId, user.id);
    setSkills((prev) => prev.filter((s) => s.id !== skillId));
  }

  async function handleCreateItem(data: { name: string; description?: string; category: "goods" | "info" | "service" | "compute"; price: number }) {
    const item = await api.createItem({ userId: user.id, ...data });
    setItems((prev) => [item, ...prev]);
    setShowItemModal(false);
  }

  async function handleCreateTask(data: { title: string; description?: string; reward: number }) {
    const task = await api.createTask({ userId: user.id, ...data });
    setTasks((prev) => [task, ...prev]);
    setShowTaskModal(false);
  }

  return (
    <div className="absolute inset-0 overflow-y-auto pb-16 pt-4 px-4" style={{ color: "var(--pixel-text)" }}>
      <div className="max-w-lg mx-auto">

        {/* === 个人信息卡片 === */}
        <div className="pixel-border p-4 mb-4" style={{ background: "var(--pixel-panel)" }}>
          <div className="flex items-start gap-4">
            <PixelAvatar name={user.name} avatarUrl={user.avatarUrl} size={56} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="pixel-font" style={{ fontSize: 13 }}>{user.name}</span>
                <span style={{ fontSize: 11, color: "var(--pixel-muted)" }}>{user.userNo}</span>
              </div>
              {user.occupation && <div style={{ fontSize: 13, color: "var(--pixel-gold)", marginTop: 2 }}>{user.occupation}</div>}
              {user.description && <div style={{ fontSize: 12, color: "var(--pixel-muted)", marginTop: 2 }}>{user.description}</div>}
              <div className="flex gap-3 mt-3 flex-wrap" style={{ fontSize: 12 }}>
                <span style={{ color: "var(--pixel-gold)" }}>⭐ {user.reputation}</span>
                <span style={{ color: "var(--pixel-gold)" }}>🪙 {user.coins}</span>
                <span style={{ color: "var(--pixel-blue)" }}>⚡ {user.compute ?? 0}</span>
              </div>
              {user.walletAddress && (
                <div style={{ fontSize: 10, color: "var(--pixel-muted)", marginTop: 4 }}>
                  💳 {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4 flex-wrap">
            <button
              className="pixel-btn pixel-btn-green"
              style={{ fontSize: 11 }}
              disabled={checkinDone}
              onClick={async () => {
                const r = await api.doCheckin(user.id);
                if (!r.alreadyDone) setCheckinDone(true);
                else setCheckinDone(true);
              }}
            >
              {checkinDone ? "✅ 已签到" : "📅 签到"}
            </button>
            <button className="pixel-btn" style={{ fontSize: 11 }} onClick={() => setShowEditProfile(true)}>✏️ 编辑</button>
            <a href="/api/auth/logout" className="pixel-btn" style={{ fontSize: 11 }}>🚪 退出</a>
          </div>
        </div>

        {/* === Tab 切换 === */}
        <div className="flex gap-1 mb-4 p-1" style={{ background: "rgba(15,52,96,0.5)" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 py-2 text-center"
              style={{
                fontSize: 11, cursor: "pointer", border: "none",
                background: tab === t.key ? "var(--pixel-panel)" : "transparent",
                color: tab === t.key ? "var(--pixel-gold)" : "var(--pixel-muted)",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* === 技能 === */}
        {tab === "skills" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <span style={{ fontSize: 13 }}>我的技能 ({skills.length})</span>
              <button className="pixel-btn pixel-btn-green" style={{ fontSize: 11 }} onClick={() => setShowSkillModal(true)}>+ 添加</button>
            </div>
            {skills.length === 0 ? (
              <div className="pixel-border p-4 text-center" style={{ background: "var(--pixel-panel)", fontSize: 13, color: "var(--pixel-muted)" }}>
                还没有技能，点击添加
              </div>
            ) : (
              skills.map((s) => (
                <div key={s.id} className="pixel-border p-3 mb-2 flex items-center justify-between" style={{ background: "var(--pixel-panel)" }}>
                  <div>
                    <div style={{ fontSize: 13 }}>🎯 {s.name}</div>
                    {s.description && <div style={{ fontSize: 11, color: "var(--pixel-muted)", marginTop: 2 }}>{s.description}</div>}
                  </div>
                  <button
                    onClick={() => handleRemoveSkill(s.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--pixel-accent)" }}
                  >✕</button>
                </div>
              ))
            )}
          </div>
        )}

        {/* === 消息 === */}
        {tab === "posts" && (
          <div>
            <div className="mb-3" style={{ fontSize: 13 }}>我的消息 ({posts.length})</div>
            {posts.length === 0 ? (
              <div className="pixel-border p-4 text-center" style={{ background: "var(--pixel-panel)", fontSize: 13, color: "var(--pixel-muted)" }}>
                还没有发布消息
              </div>
            ) : (
              posts.map((p) => (
                <div key={p.id} className="pixel-border p-3 mb-2" style={{ background: "var(--pixel-panel)" }}>
                  <p style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{p.content}</p>
                  <div className="flex gap-3 mt-2" style={{ fontSize: 11, color: "var(--pixel-muted)" }}>
                    <span>👍 {p.likes}</span>
                    <span>👎 {p.dislikes}</span>
                    <span style={{ marginLeft: "auto" }}>{timeAgo(p.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* === 商品 === */}
        {tab === "items" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <span style={{ fontSize: 13 }}>我的商品 ({items.length})</span>
              <button className="pixel-btn pixel-btn-accent" style={{ fontSize: 11 }} onClick={() => setShowItemModal(true)}>+ 上架</button>
            </div>
            {items.length === 0 ? (
              <div className="pixel-border p-4 text-center" style={{ background: "var(--pixel-panel)", fontSize: 13, color: "var(--pixel-muted)" }}>
                还没有商品，点击上架
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="pixel-border p-3 mb-2" style={{ background: "var(--pixel-panel)" }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div style={{ fontSize: 13 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: "var(--pixel-muted)", marginTop: 2 }}>
                        {CATEGORY_LABEL[item.category]} · {STATUS_LABEL[item.status]}
                      </div>
                      {item.description && <div style={{ fontSize: 11, color: "var(--pixel-muted)", marginTop: 2 }}>{item.description}</div>}
                    </div>
                    <div style={{ fontSize: 14, color: "var(--pixel-gold)", whiteSpace: "nowrap" }}>
                      🪙 {item.price} {item.tokenSymbol}
                    </div>
                  </div>
                  {item.txHash && (
                    <div style={{ fontSize: 9, color: "var(--pixel-muted)", marginTop: 4 }}>
                      TX: {item.txHash.slice(0, 10)}...
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* === 任务 === */}
        {tab === "tasks" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <span style={{ fontSize: 13 }}>我的任务 ({tasks.length})</span>
              <button className="pixel-btn pixel-btn-accent" style={{ fontSize: 11 }} onClick={() => setShowTaskModal(true)}>+ 发布</button>
            </div>
            {tasks.length === 0 ? (
              <div className="pixel-border p-4 text-center" style={{ background: "var(--pixel-panel)", fontSize: 13, color: "var(--pixel-muted)" }}>
                还没有任务，点击发布
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="pixel-border p-3 mb-2" style={{ background: "var(--pixel-panel)" }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div style={{ fontSize: 13 }}>{task.title}</div>
                      <div style={{ fontSize: 11, color: "var(--pixel-muted)", marginTop: 2 }}>
                        {STATUS_LABEL[task.status]} · {timeAgo(task.createdAt)}
                      </div>
                      {task.description && <div style={{ fontSize: 11, color: "var(--pixel-muted)", marginTop: 2 }}>{task.description}</div>}
                    </div>
                    <div style={{ fontSize: 14, color: "var(--pixel-gold)", whiteSpace: "nowrap" }}>
                      🪙 {task.reward} {task.tokenSymbol}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

        {/* === 账单 === */}
        {tab === "ledger" && (
          <div>
            <div className="mb-3" style={{ fontSize: 13 }}>交易流水</div>
            {transactions.length === 0 ? (
              <div className="pixel-border p-4 text-center" style={{ background: "var(--pixel-panel)", fontSize: 13, color: "var(--pixel-muted)" }}>
                暂无交易记录
              </div>
            ) : (
              transactions.map((tx) => {
                const isIncome = tx.toUserId === user.id;
                return (
                  <div key={tx.id} className="pixel-border p-3 mb-2 flex items-center justify-between" style={{ background: "var(--pixel-panel)" }}>
                    <div>
                      <div style={{ fontSize: 12 }}>{TX_TYPE_LABEL[tx.type] ?? tx.type}</div>
                      {tx.memo && <div style={{ fontSize: 10, color: "var(--pixel-muted)" }}>{tx.memo}</div>}
                      <div style={{ fontSize: 10, color: "var(--pixel-muted)" }}>{timeAgo(tx.createdAt)}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: "bold", color: isIncome ? "var(--pixel-green)" : "var(--pixel-accent)" }}>
                      {isIncome ? "+" : "-"}{tx.amount} XLC
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      {/* === 弹窗 === */}
      {showEditProfile && (
        <EditProfileModal
          initial={{
            name: user.name, occupation: user.occupation ?? "",
            description: user.description ?? "", walletAddress: user.walletAddress ?? "",
          }}
          onSubmit={handleEditProfile}
          onClose={() => setShowEditProfile(false)}
        />
      )}
      {showSkillModal && <SkillModal onSubmit={handleAddSkill} onClose={() => setShowSkillModal(false)} />}
      {showItemModal && <ItemModal onSubmit={handleCreateItem} onClose={() => setShowItemModal(false)} />}
      {showTaskModal && <TaskModal onSubmit={handleCreateTask} onClose={() => setShowTaskModal(false)} />}
    </div>
  );
}
