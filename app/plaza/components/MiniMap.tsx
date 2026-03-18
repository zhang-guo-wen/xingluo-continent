"use client";

import type { City } from "@/lib/types";
import { MAP_W, MAP_H } from "../constants";

interface Props {
  zones: City[];
}

export default function MiniMap({ zones }: Props) {
  return (
    <div className="minimap">
      {zones.map((zone) => (
        <div
          key={zone.id}
          style={{
            position: "absolute",
            left: (zone.gridX / MAP_W) * 120,
            top: (zone.gridY / MAP_H) * 90,
            width: (zone.gridW / MAP_W) * 120,
            height: (zone.gridH / MAP_H) * 90,
            background: zone.color + "60",
            border: "1px solid " + zone.color,
          }}
        />
      ))}
    </div>
  );
}
