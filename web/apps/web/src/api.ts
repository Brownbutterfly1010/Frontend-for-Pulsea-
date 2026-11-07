// The ONLY file that talks to the backend. Wire each TODO to your endpoint.
export type RoomState = "ready" | "occupied" | "dirty" | "maintenance";
export interface Task { id: string; title: string; kind: "housekeeping" | "fault"; done: boolean }
export interface Stay { guest: string; phone: string; checkIn: string; checkOut: string }
export interface Snapshot { room: { name: string; state: RoomState }; stay: Stay | null; tasks: Task[] }

const BASE = import.meta.env.VITE_API_URL ?? "/api/v1";
const MOCK = import.meta.env.VITE_USE_MOCK !== "false";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

let db: Snapshot = {
  room: { name: "Room 1", state: "ready" }, stay: null,
  tasks: [{ id: "t1", title: "Replace bathroom towels", kind: "housekeeping", done: false }],
};
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 250));

export const health = () => request<{ status: string }>("/health"); // real endpoint (M01)

export const getSnapshot = (): Promise<Snapshot> =>
  MOCK ? wait(db) : request("/room"); // TODO: GET /room

export const setRoomState = (state: RoomState): Promise<Snapshot> => {
  if (!MOCK) return request("/room/state", { method: "PATCH", body: JSON.stringify({ state }) }); // TODO
  db = { ...db, room: { ...db.room, state } }; return wait(db);
};
export const checkIn = (stay: Stay): Promise<Snapshot> => {
  if (!MOCK) return request("/room/check-in", { method: "POST", body: JSON.stringify(stay) }); // TODO
  db = { ...db, stay, room: { ...db.room, state: "occupied" } }; return wait(db);
};
export const checkOut = (): Promise<Snapshot> => {
  if (!MOCK) return request("/room/check-out", { method: "POST" }); // TODO
  db = { ...db, stay: null, room: { ...db.room, state: "dirty" },
    tasks: [...db.tasks, { id: crypto.randomUUID(), title: "Turn over room", kind: "housekeeping", done: false }] };
  return wait(db);
};
export const addTask = (title: string, kind: Task["kind"]): Promise<Snapshot> => {
  if (!MOCK) return request("/tasks", { method: "POST", body: JSON.stringify({ title, kind }) }); // TODO
  db = { ...db, tasks: [...db.tasks, { id: crypto.randomUUID(), title, kind, done: false }] }; return wait(db);
};
export const toggleTask = (id: string): Promise<Snapshot> => {
  if (!MOCK) return request(`/tasks/${id}/toggle`, { method: "POST" }); // TODO
  db = { ...db, tasks: db.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }; return wait(db);
};
