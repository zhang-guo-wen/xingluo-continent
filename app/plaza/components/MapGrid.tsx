"use client";

import type { PlazaUser } from "@/lib/types";
import { stringToColor } from "@/lib/utils";
import { BIG_GRID, SMALL_GRID, CELL_SIZE, GAP } from "../constants";

interface Props {
  users: PlazaUser[];           // 当前区域最多 256 人
  currentUser: PlazaUser | null;
  selectedUserId: string | null;
  onSelectUser: (user: PlazaUser) => void;
}

/** 把用户分配到 256 个格子，优先填充快满的大格 */
function assignPositions(users: PlazaUser[], currentUserId?: string): Map<string, { bigIdx: number; smallIdx: number }> {
  const map = new Map<string, { bigIdx: number; smallIdx: number }>();
  const bigCells: string[][] = Array.from({ length: BIG_GRID * BIG_GRID }, () => []);

  // 自己放在第一个大格中心
  const self = users.find((u) => u.id === currentUserId);
  if (self) {
    bigCells[0].push(self.id);
    map.set(self.id, { bigIdx: 0, smallIdx: 0 });
  }

  // 其他用户优先填快满的大格
  const others = users.filter((u) => u.id !== currentUserId);
  for (const user of others) {
    // 找最满但未满的大格
    let bestIdx = 0;
    let bestCount = -1;
    for (let i = 0; i < bigCells.length; i++) {
      const count = bigCells[i].length;
      if (count < SMALL_GRID * SMALL_GRID && count > bestCount) {
        bestCount = count;
        bestIdx = i;
      }
    }
    const smallIdx = bigCells[bestIdx].length;
    bigCells[bestIdx].push(user.id);
    map.set(user.id, { bigIdx: bestIdx, smallIdx });
  }

  return map;
}

export default function MapGrid({ users, currentUser, selectedUserId, onSelectUser }: Props) {
  const positions = assignPositions(users, currentUser?.id);
  const bigSize = SMALL_GRID * CELL_SIZE;
  const totalSize = BIG_GRID * bigSize + (BIG_GRID - 1) * GAP;

  // 构建用户查找表
  const userMap = new Map(users.map((u) => [u.id, u]));

  // 按大格组织
  const bigCells: (PlazaUser | null)[][] = Array.from({ length: BIG_GRID * BIG_GRID }, () =>
    Array.from({ length: SMALL_GRID * SMALL_GRID }, () => null)
  );
  for (const [userId, pos] of positions) {
    const user = userMap.get(userId);
    if (user) bigCells[pos.bigIdx][pos.smallIdx] = user;
  }

  return (
    <div
      className="relative mx-auto"
      style={{ width: totalSize, height: totalSize }}
    >
      {/* 16 个大格 */}
      {Array.from({ length: BIG_GRID * BIG_GRID }).map((_, bigIdx) => {
        const bigRow = Math.floor(bigIdx / BIG_GRID);
        const bigCol = bigIdx % BIG_GRID;
        const bx = bigCol * (bigSize + GAP);
        const by = bigRow * (bigSize + GAP);
        const cellUsers = bigCells[bigIdx];
        const occupied = cellUsers.filter(Boolean).length;

        return (
          <div
            key={bigIdx}
            className="absolute"
            style={{
              left: bx, top: by, width: bigSize, height: bigSize,
              background: "rgba(15,52,96,0.3)",
              border: "1px solid rgba(107,140,255,0.15)",
            }}
          >
            {/* 大格坐标标签 */}
            <div
              className="absolute pixel-font"
              style={{
                top: 2, left: 4, fontSize: 7,
                color: "rgba(255,255,255,0.2)", pointerEvents: "none",
              }}
            >
              {String.fromCharCode(65 + bigRow)}{bigCol + 1} ({occupied}/{SMALL_GRID * SMALL_GRID})
            </div>

            {/* 16 个小格 */}
            {cellUsers.map((user, smallIdx) => {
              const sr = Math.floor(smallIdx / SMALL_GRID);
              const sc = smallIdx % SMALL_GRID;
              const sx = sc * CELL_SIZE;
              const sy = sr * CELL_SIZE;
              const isSelf = user?.id === currentUser?.id;
              const isSelected = user?.id === selectedUserId;

              return (
                <div
                  key={smallIdx}
                  className="absolute"
                  style={{
                    left: sx, top: sy, width: CELL_SIZE, height: CELL_SIZE,
                    border: "1px solid rgba(255,255,255,0.05)",
                    cursor: user ? "pointer" : "default",
                    background: isSelected ? "rgba(240,192,64,0.2)" : "transparent",
                  }}
                  onClick={() => user && onSelectUser(user)}
                >
                  {user && (
                    <div className="flex flex-col items-center justify-center h-full">
                      <div
                        style={{
                          width: 28, height: 28,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: user.avatarUrl ? "transparent" : stringToColor(user.name),
                          border: isSelf ? "2px solid var(--pixel-gold)" : "1px solid rgba(255,255,255,0.2)",
                          boxShadow: isSelf ? "0 0 6px rgba(240,192,64,0.4)" : "none",
                          fontSize: 12,
                        }}
                      >
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="pixel-avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ color: "#fff" }}>{user.name[0]}</span>
                        )}
                      </div>
                      <div
                        className="pixel-font"
                        style={{
                          fontSize: 5, marginTop: 1,
                          color: isSelf ? "var(--pixel-gold)" : "#fff",
                          textShadow: "1px 1px 0 #000",
                          maxWidth: CELL_SIZE - 4,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}
                      >
                        {user.name}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
