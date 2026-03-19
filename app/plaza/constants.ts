// 地图网格：4x4 大格，每大格 4x4 小格 = 256 位
export const BIG_GRID = 4;       // 大格行/列数
export const SMALL_GRID = 4;     // 每大格内小格行/列数
export const CELL_SIZE = 48;     // 小格像素
export const GAP = 4;            // 大格间距
export const MAX_USERS = BIG_GRID * BIG_GRID * SMALL_GRID * SMALL_GRID; // 256

// 旧常量保留兼容
export const TILE = CELL_SIZE;
export const MAP_W = 20;
export const MAP_H = 15;
export const MAX_VISIBLE = MAX_USERS;
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
