export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type Season = "春日" | "夏日" | "秋日" | "冬日";
export type Vec2 = { x: number; z: number };
export type RegionId = "home" | "meadow" | "forest" | "highland";
export interface GrazingState {
  active: boolean;
  leaderId: string | null;
  regionId: RegionId;
  startedAt: number;
  grazeSeconds: number;
  watered: boolean;
  completedCount: number;
}
export interface ForageNode {
  id: string;
  regionId: RegionId;
  itemId: "mushroom" | "herb";
  position: Vec2;
  readyAt: number;
}
// Indexed appearance choices: skin/hair 0–5, outfit 0–7, hat 0–3.
export interface AvatarAppearance {
  skin: number;
  hair: number;
  outfit: number;
  hat: number;
}
export interface User {
  avatar: AvatarAppearance;
  id: string;
  username: string;
}
export interface Breed {
  id: string;
  name: string;
  rarity: Rarity;
  color: string;
  faceColor: string;
  accent: string;
  description: string;
  personality: string;
  woolValue: number;
}
export interface Crop {
  id: string;
  name: string;
  seedId: string;
  color: string;
  growSeconds: number;
  seedPrice: number;
  sellPrice: number;
  xp: number;
  description: string;
  yield: number;
}
export interface Sheep {
  id: string;
  name: string;
  breedId: string;
  sex: "female" | "male";
  bornAt: number;
  adultAt: number;
  hunger: number;
  happiness: number;
  wool: number;
  lastBredAt: number;
  petAt: number;
  position: Vec2;
  trait: string;
}
export interface Plot {
  id: string;
  position: Vec2;
  cropId: string | null;
  plantedAt: number;
  wateredAt: number;
  readyAt: number;
}
export interface Order {
  id: string;
  title: string;
  itemId: string;
  quantity: number;
  reward: number;
  xp: number;
  completed: boolean;
}
export interface FarmState {
  progression: { step: number; forestFinds: number; lastStargazeDay: number };
  buildings: { shelter: boolean; garden: boolean };
  regions: RegionId[];
  grazing: GrazingState;
  forageNodes: ForageNode[];
  version: number;
  createdAt: number;
  updatedAt: number;
  coins: number;
  xp: number;
  level: number;
  inventory: Record<string, number>;
  sheep: Sheep[];
  plots: Plot[];
  orders: Order[];
  upgrades: { pasture: number; watering: number };
  stats: {
    harvested: number;
    woolCollected: number;
    births: number;
    ordersCompleted: number;
  };
  discoveries: string[];
  weather: "sunny" | "rain";
  day: number;
  dayProgress: number;
  season: Season;
}
export interface Room {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  memberCount: number;
  onlineCount: number;
  createdAt: number;
}
export interface RoomDetail {
  room: Room;
  state: FarmState;
  serverTime: number;
}
export interface Player {
  avatar: AvatarAppearance;
  id: string;
  username: string;
  position: Vec2;
  facing: number;
  color: string;
  jumpAt?: number;
}
export type GameAction =
  | { type: "build"; facility: "shelter" | "garden" }
  | { type: "startGraze" | "waterFlock" | "finishGraze" }
  | { type: "unlockRegion"; regionId: "highland" }
  | { type: "forage"; nodeId: string }
  | { type: "rehome"; sheepId: string }
  | { type: "stargaze" }
  | { type: "feed" | "pet" | "shear"; sheepId: string }
  | { type: "breed"; sheepId: string; partnerId: string }
  | { type: "rename"; sheepId: string; name: string }
  | { type: "buy"; itemId: string; quantity: number }
  | { type: "plant"; plotId: string; cropId: string }
  | { type: "water" | "harvest"; plotId: string }
  | { type: "sell"; itemId: string; quantity: number }
  | { type: "order"; orderId: string }
  | { type: "upgrade"; upgradeId: "pasture" | "watering" }
  | { type: "adopt" };
export interface ActionResult {
  state: FarmState;
  message: string;
  serverTime: number;
}
export type ClientMessage =
  | { type: "move"; position: Vec2; facing: number; jump?: boolean }
  | { type: "whistle" }
  | { type: "chat"; text: string };
export type ServerMessage =
  | { type: "roomDeleted"; roomId: string }
  | { type: "state"; state: FarmState; serverTime: number }
  | { type: "presence"; players: Player[] }
  | { type: "whistle"; position: Vec2; at: number }
  | { type: "chat"; userId: string; username: string; text: string; at: number }
  | { type: "event"; text: string; at: number }
  | { type: "error"; message: string };

// All timestamps are Unix milliseconds. The server owns all state/economy.
// Cookies authenticate REST and WebSocket; fetch credentials: 'include'.
// Auth response: {user}; room list: {rooms}; errors: {error}; register/login: {username,password}.
// POST /api/rooms {name}; POST /api/rooms/join {code}; both return RoomDetail.
// GET /api/rooms/:id -> RoomDetail. POST .../actions body GameAction -> ActionResult.
// WebSocket /api/rooms/:id/ws sends presence + state immediately; REST actions broadcast state.
