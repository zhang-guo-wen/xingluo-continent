"use client";

import type { City } from "@/lib/types";
import { ZONE_ICONS } from "../constants";

interface Props {
  cities: City[];
  onSelectCity: (city: City) => void;
  onPropose: () => void;
}

export default function CityMapView({ cities, onSelectCity, onPropose }: Props) {
  const activeCities = cities.filter((c) => c.status === "active");
  const votingCities = cities.filter((c) => c.status === "voting");

  return (
    <div className="absolute inset-0" style={{ bottom: 56, display: "flex", flexDirection: "column" }}>
      {/* 标题 */}
      <div className="text-center py-3">
        <span className="pixel-font" style={{ fontSize: 14, color: "var(--pixel-gold)" }}>
          🌌 银河系城市
        </span>
        <span style={{ fontSize: 11, color: "var(--pixel-muted)", marginLeft: 8 }}>
          {activeCities.length} 座城市
        </span>
      </div>

      {/* 城市网格 */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="grid gap-3 max-w-2xl mx-auto" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {activeCities.map((city) => (
            <div
              key={city.id}
              className="pixel-border p-3 cursor-pointer"
              style={{ background: city.color + "20" }}
              onClick={() => onSelectCity(city)}
            >
              <div className="text-center">
                <span style={{ fontSize: 24 }}>{ZONE_ICONS[city.icon] ?? "🏠"}</span>
                <div className="pixel-font mt-1" style={{ fontSize: 10, color: "#fff" }}>{city.name}</div>
                <div style={{ fontSize: 10, color: "var(--pixel-muted)", marginTop: 4 }}>
                  ({city.galaxyX.toFixed(0)}, {city.galaxyY.toFixed(0)}, {city.galaxyZ.toFixed(0)})
                </div>
                <div style={{ fontSize: 10, color: "var(--pixel-muted)" }}>
                  👥 {city.population.toLocaleString()} / {(city.capacity / 10000).toFixed(0)}万
                </div>
              </div>
            </div>
          ))}

          {/* 投票中的城市 */}
          {votingCities.map((city) => (
            <div
              key={city.id}
              className="pixel-border p-3 cursor-pointer"
              style={{ background: city.color + "10", borderStyle: "dashed", opacity: 0.7 }}
              onClick={() => onSelectCity(city)}
            >
              <div className="text-center">
                <span style={{ fontSize: 24 }}>{ZONE_ICONS[city.icon] ?? "🏠"}</span>
                <div className="pixel-font mt-1" style={{ fontSize: 10, color: "var(--pixel-muted)" }}>{city.name}</div>
                <div style={{ fontSize: 9, color: "var(--pixel-gold)", marginTop: 4 }}>
                  🗳️ {city.voteCount}/{city.voteThreshold}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右下角建城按钮 */}
      <button
        className="action-fab"
        style={{ bottom: 70 }}
        onClick={onPropose}
      >
        🏗️
      </button>
    </div>
  );
}
