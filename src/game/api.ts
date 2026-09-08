import type { ActionResult, AvatarAppearance, GameAction, Room, RoomDetail, User } from "./types";

async function request<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "牧场暂时没有回应，请稍后再试。" }));
  if (!response.ok) throw new Error(data.error || "操作未完成，请再试一次。");
  return data as T;
}
export const api = {
  me: () => request<{ user: User }>("/auth/me"),
  auth: (mode: "login" | "register", username: string, password: string) =>
    request<{ user: User }>(`/auth/${mode}`, { username, password }),
  logout: () => request("/auth/logout", {}),
  updateProfile: (avatar: AvatarAppearance) =>
    request<{ user: User }>("/auth/profile", { avatar }, "PATCH"),
  rooms: () => request<{ rooms: Room[] }>("/rooms"),
  deleteRoom: (id: string) =>
    request<{ deletedRoomId: string; rooms: Room[] }>(`/rooms/${id}`, undefined, "DELETE"),
  create: (name: string) => request<RoomDetail>("/rooms", { name }),
  join: (code: string) => request<RoomDetail>("/rooms/join", { code }),
  room: (id: string) => request<RoomDetail>(`/rooms/${id}`),
  action: (id: string, action: GameAction) =>
    request<ActionResult>(`/rooms/${id}/actions`, action),
};
