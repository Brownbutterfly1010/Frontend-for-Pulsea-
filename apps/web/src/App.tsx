import { useEffect, useState, type FormEvent } from "react";
import * as api from "./api";
import type { RoomState, Snapshot } from "./api";

const STATES: { id: RoomState; label: string }[] = [
  { id: "ready", label: "Ready" }, { id: "occupied", label: "Occupied" },
  { id: "dirty", label: "Needs cleaning" }, { id: "maintenance", label: "Out of service" },
];
type Tab = "desk" | "tasks" | "guest";
const WA = import.meta.env.VITE_WHATSAPP_NUMBER ?? "27000000000";

export default function App() {
  const [tab, setTab] = useState<Tab>("desk");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api.getSnapshot().then(setSnap).catch(() => say("Couldn't load the room. Check the API is running."));
    api.health().then(() => setOnline(true)).catch(() => setOnline(false));
  }, []);

  function say(msg: string) { setToast(msg); window.setTimeout(() => setToast(""), 2600); }
  async function run(action: Promise<Snapshot>, msg: string) {
    try { setSnap(await action); say(msg); } catch { say("That didn't save. Try again."); }
  }

  if (!snap) return <main className="boot">Loading room…</main>;
  const open = snap.tasks.filter((t) => !t.done).length;

  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <div className="brand"><span className="dot" />Pulsea</div>
        {([["desk", "Front desk"], ["tasks", `Tasks${open ? ` (${open})` : ""}`], ["guest", "Guest link"]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
        <span className={`api ${online === false ? "off" : online ? "ok" : ""}`}>
          {online === null ? "Checking API" : online ? "API connected" : "API offline"}
        </span>
      </nav>

      <main className="main">
        {tab === "desk" && <Desk snap={snap} run={run} />}
        {tab === "tasks" && <Tasks snap={snap} run={run} />}
        {tab === "guest" && <Guest say={say} />}
      </main>
      <div className={`toast ${toast ? "show" : ""}`} role="status">{toast}</div>
    </div>
  );
}
type Run = (a: Promise<Snapshot>, m: string) => void;

function Desk({ snap, run }: { snap: Snapshot; run: Run }) {
  const { room, stay } = snap;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nights = Number(f.get("nights")) || 1;
    const out = new Date(Date.now() + nights * 864e5).toISOString().slice(0, 10);
    run(api.checkIn({ guest: String(f.get("guest")), phone: String(f.get("phone")), checkIn: new Date().toISOString().slice(0, 10), checkOut: out }), "Guest checked in");
  }
  return (
    <>
      <header className="head"><h1>{room.name}</h1><span className={`chip ${room.state}`}>{STATES.find((s) => s.id === room.state)!.label}</span></header>
      <div className="seg" role="group" aria-label="Room status">
        {STATES.map((s) => (
          <button key={s.id} className={room.state === s.id ? "on" : ""} disabled={room.state === "occupied" && s.id !== "occupied"}
            onClick={() => run(api.setRoomState(s.id), `Marked ${s.label.toLowerCase()}`)}>{s.label}</button>
        ))}
      </div>
      {stay ? (
        <section className="card">
          <h2>{stay.guest}</h2>
          <p className="muted">{stay.phone} · {stay.checkIn} to {stay.checkOut}</p>
          <div className="row">
            <a className="btn ghost" href={`https://wa.me/${stay.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Message on WhatsApp</a>
            <button className="btn" onClick={() => run(api.checkOut(), "Checked out. Cleaning task added")}>Check out</button>
          </div>
        </section>
      ) : (
        <form className="card" onSubmit={submit}>
          <h2>Check in a guest</h2>
          <div className="grid">
            <label>Full name<input name="guest" required placeholder="Thando Dlamini" /></label>
            <label>WhatsApp number<input name="phone" required inputMode="tel" placeholder="27 82 123 4567" /></label>
            <label>Nights<input name="nights" type="number" min={1} defaultValue={1} /></label>
          </div>
          <button className="btn" disabled={room.state !== "ready"}>Check in</button>
          {room.state !== "ready" && <p className="muted">Mark the room Ready before checking in.</p>}
        </form>
      )}
    </>
  );
}

function Tasks({ snap, run }: { snap: Snapshot; run: Run }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"housekeeping" | "fault">("housekeeping");
  return (
    <>
      <header className="head"><h1>Tasks</h1></header>
      <form className="card row" onSubmit={(e) => { e.preventDefault(); if (title.trim()) { run(api.addTask(title.trim(), kind), "Task added"); setTitle(""); } }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" aria-label="Task" />
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Type">
          <option value="housekeeping">Housekeeping</option><option value="fault">Fault</option>
        </select>
        <button className="btn">Add task</button>
      </form>
      {snap.tasks.length === 0 && <p className="muted">No tasks. Add one above.</p>}
      <ul className="list">
        {snap.tasks.map((t) => (
          <li key={t.id} className={t.done ? "done" : ""}>
            <label><input type="checkbox" checked={t.done} onChange={() => run(api.toggleTask(t.id), t.done ? "Task reopened" : "Task done")} />{t.title}</label>
            <span className={`tag ${t.kind}`}>{t.kind === "fault" ? "Fault" : "Housekeeping"}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Guest({ say }: { say: (m: string) => void }) {
  const [room, setRoom] = useState("room-1");
  const link = `${location.origin}/stay/${room}`;
  const wa = `https://wa.me/${WA}?text=${encodeURIComponent(`Hi, I'm in ${room.replace("-", " ")} and need help.`)}`;
  return (
    <>
      <header className="head"><h1>Guest link</h1></header>
      <section className="card">
        <p className="muted">Guests open this on their phone. No app or account.</p>
        <label>Room<input value={room} onChange={(e) => setRoom(e.target.value.toLowerCase().replace(/\s+/g, "-"))} /></label>
        <code className="link">{link}</code>
        <div className="row">
          <button className="btn" onClick={() => navigator.clipboard.writeText(link).then(() => say("Link copied"))}>Copy link</button>
          <a className="btn ghost" href={wa} target="_blank" rel="noreferrer">Test WhatsApp message</a>
        </div>
      </section>
    </>
  );
}
