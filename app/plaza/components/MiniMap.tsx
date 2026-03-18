"use client";

import type { Zone } from "@/lib/types";
import { MAP_W, MAP_H } from "../constants";

interface Props {
  zones: Zone[];
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
