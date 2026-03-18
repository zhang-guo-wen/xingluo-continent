// 兼容层：zones → cities 迁移
// 所有新代码请直接使用 lib/cities.ts

export { getAllCities as getAllZones, proposeCity as proposeZone, voteCity as voteForZone } from "./cities";
export type { City as Zone, CityVote as ZoneVote } from "./types";
