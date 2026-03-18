export const TILE = 48;
export const MAP_W = 20;
export const MAP_H = 15;
export const MAX_VISIBLE = 17;
export const GRID_COLS = 4;
export const GRID_ROWS = 4;

export const ZONE_ICONS: Record<string, string> = {
  castle: "🏰", house: "🏠", tree: "🌲",
  cave: "🕳️", tower: "🗼", market: "🏪",
};

export const ZONE_COLORS = [
  "#4a9c5d", "#6b8cff", "#e94560", "#f0c040",
  "#9b59b6", "#e67e22", "#1abc9c", "#e74c3c",
];

export const NPC_CONFIG = {
  name: "星域官",
  title: "区域管理",
  gridX: 6,
  gridY: 6,
};
