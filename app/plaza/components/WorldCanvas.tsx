"use client";

import { useState, useRef } from "react";
import type { City } from "@/lib/types";
import { ZONE_ICONS } from "../constants";

const CITY_SIZE = 120;  // 城市方块尺寸
const CITY_GAP = 20;    // 城市间最小间距
const SLOT = CITY_SIZE + CITY_GAP; // 每个槽位占用

interface Props {
  cities: City[];
  onSelectCity: (city: City) => void;
  onPropose: () => void;
}

export default function WorldCanvas({ cities, onSelectCity, onPropose }: Props) {
  // 画布偏移（拖拽平移）
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  function onPointerDown(e: React.PointerEvent) {
    setDragging(true);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setOffset({
      x: dragRef.current.ox + (e.clientX - dragRef.current.x),
      y: dragRef.current.oy + (e.clientY - dragRef.current.y),
    });
  }

  // 螺旋布局：按银河坐标排序后，从中心螺旋向外分配槽位，不重叠
  function layoutCities(list: City[]): Map<string, { x: number; y: number }> {
    const sorted = [...list].sort((a, b) => {
      const da = a.galaxyX * a.galaxyX + a.galaxyY * a.galaxyY;
      const db = b.galaxyX * b.galaxyX + b.galaxyY * b.galaxyY;
      return da - db;
    });
    const positions = new Map<string, { x: number; y: number }>();
    const occupied = new Set<string>();

    // 螺旋方向序列
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    let cx = 0, cy = 0, dirIdx = 0, steps = 1, stepCount = 0, turnCount = 0;

    for (const city of sorted) {
      // 找到当前螺旋位置
      while (occupied.has(`${cx},${cy}`)) {
        cx += dirs[dirIdx][0];
        cy += dirs[dirIdx][1];
        stepCount++;
        if (stepCount >= steps) {
          stepCount = 0;
          dirIdx = (dirIdx + 1) % 4;
          turnCount++;
          if (turnCount >= 2) { turnCount = 0; steps++; }
        }
      }
      occupied.add(`${cx},${cy}`);
      positions.set(city.id, { x: cx * SLOT, y: cy * SLOT });
      // 继续螺旋
      cx += dirs[dirIdx][0];
      cy += dirs[dirIdx][1];
      stepCount++;
      if (stepCount >= steps) {
        stepCount = 0;
        dirIdx = (dirIdx + 1) % 4;
        turnCount++;
        if (turnCount >= 2) { turnCount = 0; steps++; }
      }
    }
    return positions;
  }

  const cityPositions = layoutCities(cities);

  return (
    <div
      className="absolute"
      style={{
        top: 0, left: 0, right: 0, bottom: 56,
        overflow: "hidden",
        cursor: dragging ? "grabbing" : "grab",
        background: "var(--pixel-bg)",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDragging(false)}
    >
      {/* 星空背景网格 */}
      <div
        className="absolute"
        style={{
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          backgroundPosition: `${offset.x % 40}px ${offset.y % 40}px`,
          pointerEvents: "none",
        }}
      />

      {/* 坐标轴 */}
      <div
        className="absolute"
        style={{
          left: `calc(50% + ${offset.x}px)`,
          top: 0, bottom: 0, width: 1,
          background: "rgba(107,140,255,0.1)",
          pointerEvents: "none",
        }}
      />
      <div
        className="absolute"
        style={{
          top: `calc(50% + ${offset.y}px)`,
          left: 0, right: 0, height: 1,
          background: "rgba(107,140,255,0.1)",
          pointerEvents: "none",
        }}
      />

      {/* 原点标签 */}
      <div
        className="absolute pixel-font"
        style={{
          left: `calc(50% + ${offset.x + 6}px)`,
          top: `calc(50% + ${offset.y + 4}px)`,
          fontSize: 7, color: "rgba(107,140,255,0.3)",
          pointerEvents: "none",
        }}
      >
        (0,0)
      </div>

      {/* 城市 */}
      {cities.map((city) => {
        const pos = cityPositions.get(city.id) ?? { x: 0, y: 0 };
        const isActive = city.status === "active";
        return (
          <div
            key={city.id}
            className="absolute"
            style={{
              left: `calc(50% + ${offset.x + pos.x - CITY_SIZE / 2}px)`,
              top: `calc(50% + ${offset.y + pos.y - CITY_SIZE / 2}px)`,
              width: CITY_SIZE,
              height: CITY_SIZE,
              cursor: "pointer",
              transition: dragging ? "none" : "box-shadow 0.2s",
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!dragging) onSelectCity(city);
            }}
          >
            <div
              className="w-full h-full flex flex-col items-center justify-center pixel-border"
              style={{
                background: city.color + (isActive ? "30" : "10"),
                borderStyle: isActive ? "solid" : "dashed",
                opacity: isActive ? 1 : 0.6,
              }}
            >
              <span style={{ fontSize: 28 }}>{ZONE_ICONS[city.icon] ?? "🏠"}</span>
              <div className="pixel-font mt-1" style={{ fontSize: 8, color: "#fff", textShadow: "1px 1px 0 #000" }}>
                {city.name}
              </div>
              <div style={{ fontSize: 8, color: "var(--pixel-muted)", marginTop: 2 }}>
                ({city.galaxyX.toFixed(0)}, {city.galaxyY.toFixed(0)})
              </div>
              <div style={{ fontSize: 8, color: isActive ? "var(--pixel-green)" : "var(--pixel-gold)" }}>
                {isActive
                  ? `👥 ${city.population.toLocaleString()}`
                  : `🗳️ ${city.voteCount}/${city.voteThreshold}`
                }
              </div>
            </div>
          </div>
        );
      })}

      {/* 标题 */}
      <div className="absolute top-3 left-0 right-0 text-center pointer-events-none">
        <span className="pixel-font" style={{ fontSize: 14, color: "var(--pixel-gold)" }}>
          🌌 星罗世界
        </span>
        <span style={{ fontSize: 11, color: "var(--pixel-muted)", marginLeft: 8 }}>
          {cities.filter((c) => c.status === "active").length} 座城市
        </span>
      </div>

      {/* 右下角建城按钮 */}
      <button
        className="action-fab"
        style={{ bottom: 70 }}
        onClick={(e) => { e.stopPropagation(); onPropose(); }}
      >
        🏗️
      </button>
    </div>
  );
}
