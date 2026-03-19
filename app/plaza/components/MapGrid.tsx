"use client";

import type { PlazaUser } from "@/lib/types";
import { stringToColor } from "@/lib/utils";
import { BIG_GRID, SMALL_GRID } from "../constants";

interface Props {
  users: PlazaUser[];
  currentUser: PlazaUser | null;
  selectedUserId: string | null;
  onSelectUser: (user: PlazaUser) => void;
}

function assignPositions(users: PlazaUser[], currentUserId?: string): Map<string, { bigIdx: number; smallIdx: number }> {
  const map = new Map<string, { bigIdx: number; smallIdx: number }>();
  const bigCells: string[][] = Array.from({ length: BIG_GRID * BIG_GRID }, () => []);
  const maxPerBig = SMALL_GRID * SMALL_GRID;

  const self = users.find((u) => u.id === currentUserId);
  if (self) {
    bigCells[0].push(self.id);
    map.set(self.id, { bigIdx: 0, smallIdx: 0 });
  }

  const others = users.filter((u) => u.id !== currentUserId);
  for (const user of others) {
    let bestIdx = 0, bestCount = -1;
    for (let i = 0; i < bigCells.length; i++) {
      const c = bigCells[i].length;
      if (c < maxPerBig && c > bestCount) { bestCount = c; bestIdx = i; }
    }
    const smallIdx = bigCells[bestIdx].length;
    bigCells[bestIdx].push(user.id);
    map.set(user.id, { bigIdx: bestIdx, smallIdx });
  }
  return map;
}

export default function MapGrid({ users, currentUser, selectedUserId, onSelectUser }: Props) {
  const positions = assignPositions(users, currentUser?.id);
  const userMap = new Map(users.map((u) => [u.id, u]));

  const bigCells: (PlazaUser | null)[][] = Array.from({ length: BIG_GRID * BIG_GRID }, () =>
    Array.from({ length: SMALL_GRID * SMALL_GRID }, () => null)
  );
  for (const [userId, pos] of positions) {
    const user = userMap.get(userId);
    if (user) bigCells[pos.bigIdx][pos.smallIdx] = user;
  }

  // 用百分比布局，不会出现滚动条
  const bigGap = 0.5; // vmin
  const bigPct = (100 - bigGap * (BIG_GRID - 1)) / BIG_GRID;

  return (
    <div
      style={{
        width: "100%", height: "100%",
        display: "grid",
        gridTemplateColumns: `repeat(${BIG_GRID}, 1fr)`,
        gridTemplateRows: `repeat(${BIG_GRID}, 1fr)`,
        gap: "3px",
      }}
    >
      {Array.from({ length: BIG_GRID * BIG_GRID }).map((_, bigIdx) => {
        const cellUsers = bigCells[bigIdx];
        const occupied = cellUsers.filter(Boolean).length;
        const bigRow = Math.floor(bigIdx / BIG_GRID);
        const bigCol = bigIdx % BIG_GRID;

        return (
          <div
            key={bigIdx}
            style={{
              background: "rgba(15,52,96,0.3)",
              border: "1px solid rgba(107,140,255,0.12)",
              position: "relative",
              display: "grid",
              gridTemplateColumns: `repeat(${SMALL_GRID}, 1fr)`,
              gridTemplateRows: `repeat(${SMALL_GRID}, 1fr)`,
              gap: "1px",
            }}
          >
            {/* 大格坐标 */}
            <div
              className="pixel-font"
              style={{
                position: "absolute", top: 1, left: 3, fontSize: 6,
                color: "rgba(255,255,255,0.2)", pointerEvents: "none", zIndex: 1,
              }}
            >
              {String.fromCharCode(65 + bigRow)}{bigCol + 1}
            </div>

            {cellUsers.map((user, smallIdx) => {
              const isSelf = user?.id === currentUser?.id;
              const isSelected = user?.id === selectedUserId;

              return (
                <div
                  key={smallIdx}
                  style={{
                    border: "1px solid rgba(255,255,255,0.04)",
                    cursor: user ? "pointer" : "default",
                    background: isSelected ? "rgba(240,192,64,0.2)" : "transparent",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    overflow: "hidden", minWidth: 0, minHeight: 0,
                  }}
                  onClick={() => user && onSelectUser(user)}
                >
                  {user && (
                    <>
                      <div
                        style={{
                          width: "60%", aspectRatio: "1",
                          maxWidth: 32, maxHeight: 32,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: user.avatarUrl ? "transparent" : stringToColor(user.name),
                          border: isSelf ? "2px solid var(--pixel-gold)" : "1px solid rgba(255,255,255,0.2)",
                          boxShadow: isSelf ? "0 0 4px rgba(240,192,64,0.4)" : "none",
                          fontSize: "clamp(8px, 1.5vmin, 14px)",
                        }}
                      >
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="pixel-avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ color: "#fff" }}>{user.name[0]}</span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "clamp(4px, 0.8vmin, 7px)",
                          color: isSelf ? "var(--pixel-gold)" : "#fff",
                          textShadow: "1px 1px 0 #000",
                          maxWidth: "90%",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          marginTop: 1,
                        }}
                      >
                        {user.name}
                      </div>
                    </>
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
