import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from "recharts";
import * as XLSX from "xlsx";
import {
  LayoutDashboard, Clock, FileText, CalendarDays, Wallet, Receipt,
  AlertTriangle, BarChart3, Settings as SettingsIcon, Search, Plus,
  Play, Pause, Square, Sun, Moon, Download, Printer, X, Trash2, Edit2,
  TrendingUp, ChevronLeft, ChevronRight, FileSpreadsheet,
  IndianRupee, CheckCircle2, CircleDollarSign, Users, LogOut, ShieldCheck,
  KeyRound, UserPlus, Eye, RefreshCw, Lock, ArrowLeft, Menu, Bell,
  TrendingDown, Award, Send, Monitor, CheckCheck, Database
} from "lucide-react";

/* ---------------------------------- constants ---------------------------------- */

const K = {
  users: "wfp:users",
  session: "wfp:session",
};
const dataKey = (userId, name) => `emp:${userId}:${name}`;

const LEAVE_TYPES = ["Paid Leave", "Unpaid Leave", "Half Day", "Sick Leave", "Casual Leave", "Emergency Leave"];
const EXPENSE_CATS = ["Travel", "Fuel", "Food", "Internet", "Laptop", "Office", "Software", "Other"];
const PAY_MODES = ["Bank Transfer", "UPI", "Cash", "Cheque", "Other"];
const PRIORITIES = ["Low", "Medium", "High"];
const STATUSES = ["Pending", "In Progress", "Completed"];

const CAL_COLORS = {
  work: "#3ecf8e",
  leave: "#e6b325",
  fine: "#e5484d",
  salary: "#4d7cfe",
  expense: "#a970ff",
};

const HISTORY_EVENT_COLORS = {
  Promotion: "#3ecf8e",
  Demotion: "#e5484d",
  "Role Change": "#4d7cfe",
  "Company Change": "#a970ff",
  Transfer: "#e6b325",
};

const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const inRange = (dateStr, from, to) => dateStr >= from && dateStr <= to;
const fmtMoney = (n, cur) =>
  cur + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function computeHours(start, end, breakMins) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === null || e === null) return 0;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  diff -= Number(breakMins || 0);
  return Math.max(0, round2(diff / 60));
}
function computeSalary(hours, rate) {
  const regular = Math.min(hours, 8);
  const overtime = Math.max(hours - 8, 0);
  return round2(regular * rate + overtime * rate * 1.5);
}
function netSalaryFor(reports, fines, expenses, from, to) {
  const wr = reports.filter((r) => inRange(r.date, from, to));
  const fn = fines.filter((f) => inRange(f.date, from, to));
  const ex = expenses.filter((e) => inRange(e.date, from, to));
  const gross = round2(wr.reduce((s, r) => s + Number(r.salary || 0), 0));
  const totalFine = round2(fn.reduce((s, r) => s + Number(r.amount || 0), 0));
  const totalExpense = round2(ex.reduce((s, r) => s + Number(r.amount || 0), 0));
  const totalHours = round2(wr.reduce((s, r) => s + Number(r.hours || 0), 0));
  return { gross, totalFine, totalExpense, totalHours, net: round2(gross - totalFine - totalExpense) };
}
async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------------------------------- storage hook ---------------------------------- */

function useStorage(key, initial, shared) {
  const [value, setValue] = useState(initial);
  const [loadedKey, setLoadedKey] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoadedKey(null); // Reset loaded key when key changes
    (async () => {
      try {
        const res = await window.storage.get(key, shared);
        if (!cancelled && res && res.value) setValue(JSON.parse(res.value));
        else if (!cancelled) setValue(initial);
      } catch (e) {
        if (!cancelled) setValue(initial);
      } finally {
        if (!cancelled) setLoadedKey(key); // Mark this specific key as loaded
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, shared]);

  useEffect(() => {
    // ONLY save to storage if we have successfully loaded data for THIS EXACT key
    if (loadedKey !== key) return;
    window.storage.set(key, JSON.stringify(value), shared).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, loadedKey, key, shared]);

  return [value, setValue, loadedKey === key];
}

/* ---------------------------------- small UI atoms ---------------------------------- */

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-[var(--line)] bg-[var(--panel)] ${className}`}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, tint }) {
  return (
    <Card className="p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-[var(--muted)]">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: tint + "22", color: tint }}>
          <Icon size={16} />
        </div>
      </div>
      <div className="font-mono text-2xl font-semibold text-[var(--ink)] truncate">{value}</div>
      {sub && <div className="text-xs text-[var(--muted)]">{sub}</div>}
    </Card>
  );
}

function Button({ children, onClick, variant = "primary", className = "", type = "button", disabled }) {
  const base = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-[var(--accent)] text-white hover:brightness-110 shadow-sm",
    ghost: "bg-transparent text-[var(--ink)] hover:bg-[var(--hover)]",
    outline: "border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--hover)]",
    danger: "bg-transparent text-[var(--danger)] hover:bg-[var(--danger)]/10",
    success: "bg-[#3ecf8e] text-white hover:brightness-110 shadow-sm",
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] disabled:opacity-50";

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[88vh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xl`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--ink)] text-base">{title}</h3>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)]"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------- Confirm Dialog ---------------------------------- */

function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = "OK", danger = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-2xl">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 mx-auto ${danger ? "bg-[var(--danger)]/15" : "bg-[var(--accent)]/15"}`}>
          <AlertTriangle size={20} className={danger ? "text-[var(--danger)]" : "text-[var(--accent)]"} />
        </div>
        <h3 className="text-base font-semibold text-[var(--ink)] text-center mb-2">{title}</h3>
        {message && <p className="text-sm text-[var(--muted)] text-center mb-5">{message}</p>}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium text-white transition-all active:scale-[0.97] ${danger ? "bg-[var(--danger)] hover:brightness-110" : "bg-[var(--accent)] hover:brightness-110"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function useConfirm() {
  const [state, setState] = useState(null);
  const ask = (opts) => new Promise((resolve) => { setState({ ...opts, resolve }); });
  const close = () => { state?.resolve(false); setState(null); };
  const confirm = () => { state?.resolve(true); setState(null); };
  const Dialog = state ? (
    <ConfirmModal open={true} onClose={close} onConfirm={confirm} title={state.title} message={state.message} confirmLabel={state.confirmLabel} danger={state.danger} />
  ) : null;
  return { ask, Dialog };
}

function EmptyState({ label }) {
  return <div className="text-center py-10 text-sm text-[var(--muted)]">{label}</div>;
}

/* ---------------------------------- Notification Bell ---------------------------------- */

function NotificationBell({ notifications, onMarkRead, onMarkAll }) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(null);
  const unread = notifications.filter((n) => !n.read).length;
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative p-2 rounded-lg hover:bg-[var(--hover)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[var(--danger)] text-white text-[9px] rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)]">
            <span className="font-semibold text-sm text-[var(--ink)]">Notifications</span>
            {unread > 0 && (
              <button onClick={onMarkAll} className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-xs text-[var(--muted)] text-center py-8">No notifications yet</div>
            ) : (
              [...notifications].reverse().map((n) => (
                <div key={n.id} onClick={() => { if (!n.read) onMarkRead(n.id); setReading(n); setOpen(false); }}
                  className={`px-4 py-3 border-b border-[var(--line)] last:border-0 cursor-pointer hover:bg-[var(--hover)] transition-colors ${!n.read ? "bg-[var(--accent)]/5" : ""}`}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${!n.read ? "bg-[var(--accent)]" : "bg-transparent"}`} />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[var(--ink)]">{n.title}</div>
                      <div className="text-xs text-[var(--muted)] mt-0.5">{n.message}</div>
                      <div className="text-[10px] text-[var(--muted)] mt-1 font-mono">{n.date} · From: Admin</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      <Modal open={!!reading} onClose={() => setReading(null)} title="Notification">
        {reading && (
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-[var(--ink)] text-lg">{reading.title}</h3>
            <p className="text-sm text-[var(--ink)] whitespace-pre-wrap">{reading.message}</p>
            <div className="text-xs text-[var(--muted)] font-mono">{reading.date} &middot; From Admin</div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setReading(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Pill({ children, color }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: color + "22", color }}>
      {children}
    </span>
  );
}

/* ---------------------------------- Auth ---------------------------------- */

function AuthScreen({ users, setUsers, onLogin }) {
  const [mode, setMode] = useState(users.length === 0 ? "register" : "login");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        const u = users.find((u) => u.email.toLowerCase() === form.email.trim().toLowerCase());
        if (!u) { setError("No account with that email."); return; }
        if (!u.active) { setError("This account has been deactivated. Contact your admin."); return; }
        const hash = await hashPassword(form.password);
        if (hash !== u.passwordHash) { setError("Incorrect password."); return; }
        onLogin(u, remember);
      } else {
        if (!form.name.trim() || !form.email.trim() || !form.password) { setError("Fill in all fields."); return; }
        if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
        if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
        if (users.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase())) { setError("An account with that email already exists."); return; }
        const hash = await hashPassword(form.password);
        const newUser = {
          id: uid(), name: form.name.trim(), email: form.email.trim(), passwordHash: hash,
          role: users.length === 0 ? "admin" : "employee",
          hourlyRate: 0, currency: "\u20b9", company: "Freelance", department: "", phone: "", designation: "", location: "", history: "", employmentHistory: [],
          joiningDate: todayStr(), active: true,
        };
        setUsers((prev) => [...prev, newUser]);
        onLogin(newUser, remember);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg)] text-[var(--ink)] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="font-semibold text-xl tracking-tight">WorkFlow Pro</div>
          <div className="text-xs text-[var(--muted)]">Professional work, salary & payroll management</div>
        </div>
        <Card className="p-5">
          <div className="flex rounded-lg border border-[var(--line)] p-1 mb-4">
            <button onClick={() => setMode("login")} className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === "login" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}>Log in</button>
            <button onClick={() => setMode("register")} className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === "register" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}>Register</button>
          </div>
          {users.length === 0 && mode === "register" && (
            <div className="text-xs rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] p-2.5 mb-3">
              No account exists yet â€” the first account you create becomes the admin.
            </div>
          )}
          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === "register" && (
              <Field label="Full name"><input className={inputCls} value={form.name} onChange={set("name")} /></Field>
            )}
            <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={set("email")} /></Field>
            <Field label="Password"><input type="password" className={inputCls} value={form.password} onChange={set("password")} /></Field>
            {mode === "register" && (
              <Field label="Confirm password"><input type="password" className={inputCls} value={form.confirm} onChange={set("confirm")} /></Field>
            )}
            {mode === "login" && (
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me on this device
              </label>
            )}
            {error && <div className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 rounded-lg p-2">{error}</div>}
            <Button type="submit" className="justify-center mt-1" disabled={busy}>
              {mode === "login" ? "Log in" : "Create account"}
            </Button>
          </form>
          {mode === "login" && (
            <div className="text-xs text-center text-[var(--muted)] mt-3">
              Forgot your password? Ask your admin to reset it for you from Employee Management.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------- Employment History Timeline (Read-only) ---------------------------------- */

function EmploymentHistoryTimeline({ history = [] }) {
  const sorted = [...(history || [])].sort((a, b) => (b.date > a.date ? 1 : -1));
  if (sorted.length === 0) {
    return <div className="text-xs text-[var(--muted)] py-4 text-center">No employment history recorded yet.</div>;
  }
  return (
    <div className="flex flex-col gap-0">
      {sorted.map((ev, i) => {
        const color = HISTORY_EVENT_COLORS[ev.event] || "#8a8f98";
        return (
          <div key={ev.id || i} className="relative flex gap-4 pb-5">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2" style={{ background: color + "22", borderColor: color }}>
                {ev.event === "Promotion" && <Award size={14} style={{ color }} />}
                {ev.event === "Demotion" && <TrendingDown size={14} style={{ color }} />}
                {ev.event !== "Promotion" && ev.event !== "Demotion" && <Edit2 size={14} style={{ color }} />}
              </div>
              {i < sorted.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: color + "44" }} />}
            </div>
            <div className="flex-1 pt-1.5 pb-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-[var(--ink)]">{ev.event}</span>
                <span className="text-xs font-mono text-[var(--muted)]">{ev.date}</span>
              </div>
              {(ev.designation || ev.company) && (
                <div className="text-xs text-[var(--muted)] mt-0.5">
                  {ev.designation && <span><span className="font-medium text-[var(--ink)]">Designation:</span> {ev.designation}</span>}
                  {ev.designation && ev.company && " · "}
                  {ev.company && <span><span className="font-medium text-[var(--ink)]">Company:</span> {ev.company}</span>}
                </div>
              )}
              {ev.notes && <div className="text-xs text-[var(--muted)] mt-1 italic">"{ev.notes}"</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------- Work Reports ---------------------------------- */

function WorkReportForm({ initial, onSave, onClose, rate }) {
  const [f, setF] = useState(
    initial || {
      id: uid(), date: todayStr(), project: "", task: "", description: "",
      startTime: "09:00", endTime: "17:00", breakMins: 30, overtimeManual: "",
      priority: "Medium", status: "In Progress", tags: "", notes: "",
    }
  );
  const hours = computeHours(f.startTime, f.endTime, f.breakMins);
  const salary = computeSalary(hours, rate);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className={inputCls} value={f.date} onChange={set("date")} /></Field>
        <Field label="Project"><input className={inputCls} value={f.project} onChange={set("project")} placeholder="Project name" /></Field>
      </div>
      <Field label="Task title"><input className={inputCls} value={f.task} onChange={set("task")} placeholder="What did you work on" /></Field>
      <Field label="Description"><textarea className={inputCls} rows={2} value={f.description} onChange={set("description")} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Start time"><input type="time" className={inputCls} value={f.startTime} onChange={set("startTime")} /></Field>
        <Field label="End time"><input type="time" className={inputCls} value={f.endTime} onChange={set("endTime")} /></Field>
        <Field label="Break (mins)"><input type="number" min="0" className={inputCls} value={f.breakMins} onChange={set("breakMins")} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority">
          <select className={inputCls} value={f.priority} onChange={set("priority")}>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} value={f.status} onChange={set("status")}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Tags (comma separated)"><input className={inputCls} value={f.tags} onChange={set("tags")} placeholder="frontend, bugfix" /></Field>
      <Field label="Notes / narration"><textarea className={inputCls} rows={2} value={f.notes} onChange={set("notes")} /></Field>
      <div className="rounded-xl bg-[var(--bg)] border border-[var(--line)] p-3 flex items-center justify-between">
        <div className="text-xs text-[var(--muted)]">Auto-calculated</div>
        <div className="font-mono text-sm text-[var(--ink)]">{hours}h &middot; salary {fmtMoney(salary, "")}</div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave({ ...f, hours, salary })}>Save entry</Button>
      </div>
    </div>
  );
}

function WorkReportsView({ reports, setReports, rate, currency, search }) {
  const [modal, setModal] = useState(null);
  const { ask, Dialog } = useConfirm();

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let list = [...reports].sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!s) return list;
    return list.filter((r) =>
      [r.project, r.task, r.notes, r.tags].join(" ").toLowerCase().includes(s)
    );
  }, [reports, search]);

  const save = (data) => {
    setReports((prev) => {
      const exists = prev.some((r) => r.id === data.id);
      return exists ? prev.map((r) => (r.id === data.id ? data : r)) : [...prev, data];
    });
    setModal(null);
  };
  const remove = async (id) => {
    const ok = await ask({ title: "Delete Entry?", message: "This work entry will be permanently deleted.", confirmLabel: "Delete", danger: true });
    if (ok) setReports((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="flex flex-col gap-4">
      {Dialog}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--ink)]">Work reports</h2>
        <Button onClick={() => setModal({ mode: "new" })}><Plus size={16} />New entry</Button>
      </div>
      <Card className="overflow-x-auto">
        {filtered.length === 0 ? <EmptyState label="No work logged yet. Add your first entry." /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)]">
                <th className="p-3">Date</th><th className="p-3">Project / Task</th><th className="p-3">Hours</th>
                <th className="p-3">Salary</th><th className="p-3">Status</th><th className="p-3">Priority</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--hover)]">
                  <td className="p-3 font-mono text-xs whitespace-nowrap">{r.date}</td>
                  <td className="p-3">
                    <div className="font-medium text-[var(--ink)]">{r.project || "â€”"}</div>
                    <div className="text-xs text-[var(--muted)]">{r.task}</div>
                  </td>
                  <td className="p-3 font-mono">{r.hours}h</td>
                  <td className="p-3 font-mono">{fmtMoney(r.salary, currency)}</td>
                  <td className="p-3"><Pill color={r.status === "Completed" ? CAL_COLORS.work : r.status === "In Progress" ? CAL_COLORS.salary : CAL_COLORS.leave}>{r.status}</Pill></td>
                  <td className="p-3"><Pill color={r.priority === "High" ? CAL_COLORS.fine : r.priority === "Medium" ? CAL_COLORS.leave : "#8a8f98"}>{r.priority}</Pill></td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button onClick={() => setModal({ mode: "edit", data: r })} className="text-[var(--muted)] hover:text-[var(--ink)] mr-2"><Edit2 size={14} /></button>
                    <button onClick={() => remove(r.id)} className="text-[var(--muted)] hover:text-[var(--danger)]"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === "edit" ? "Edit entry" : "New work entry"} wide>
        {modal && <WorkReportForm initial={modal.data} onSave={save} onClose={() => setModal(null)} rate={rate} />}
      </Modal>
    </div>
  );
}

/* ---------------------------------- Live Timer ---------------------------------- */

function TimerCard({ timer, setTimer, onFinish, rate }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer.running]);

  const liveSeconds = timer.accumulated + (timer.running ? (now - timer.startedAt) / 1000 : 0);
  const h = Math.floor(liveSeconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((liveSeconds % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(liveSeconds % 60).toString().padStart(2, "0");
  const liveHours = round2(liveSeconds / 3600);
  const liveSalary = computeSalary(liveHours, rate);

  const start = () => setTimer({ ...timer, running: true, startedAt: Date.now() });
  const pause = () => setTimer({ ...timer, running: false, accumulated: liveSeconds, startedAt: null });
  const stop = () => {
    const finalHours = round2(liveSeconds / 3600);
    setTimer({ running: false, accumulated: 0, startedAt: null, project: "", task: "" });
    onFinish(finalHours);
  };

  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-[var(--muted)]">Live timer</span>
        <span className="w-2 h-2 rounded-full" style={{ background: timer.running ? CAL_COLORS.work : "#8a8f98" }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input className={inputCls} placeholder="Project" value={timer.project} onChange={(e) => setTimer({ ...timer, project: e.target.value })} />
        <input className={inputCls} placeholder="Task" value={timer.task} onChange={(e) => setTimer({ ...timer, task: e.target.value })} />
      </div>
      <div className="font-mono text-4xl text-center tracking-widest text-[var(--ink)] py-2">{h}:{m}:{s}</div>
      <div className="text-center text-xs text-[var(--muted)] font-mono">â‰ˆ {fmtMoney(liveSalary, "")} at current rate</div>
      <div className="flex justify-center gap-2">
        {!timer.running ? (
          <Button onClick={start}><Play size={15} />{timer.accumulated > 0 ? "Resume" : "Start"}</Button>
        ) : (
          <Button variant="outline" onClick={pause}><Pause size={15} />Pause</Button>
        )}
        <Button variant="danger" onClick={stop} disabled={liveSeconds < 1}><Square size={15} />Stop &amp; log</Button>
      </div>
    </Card>
  );
}

/* ---------------------------------- Generic record manager ---------------------------------- */

function RecordManager({ title, icon: Icon, color, fields, records, setRecords, currency, amountKey, search = "" }) {
  const [modal, setModal] = useState(null);
  const { ask, Dialog } = useConfirm();
  const blank = () => {
    const o = { id: uid() };
    fields.forEach((f) => (o[f.key] = f.type === "select" ? f.options[0] : f.type === "number" ? 0 : ""));
    o.date = todayStr();
    return o;
  };
  const [form, setForm] = useState(blank());
  useEffect(() => { if (modal) setForm(modal.data || blank()); }, [modal]);

  const save = () => {
    setRecords((prev) => {
      const exists = prev.some((r) => r.id === form.id);
      return exists ? prev.map((r) => (r.id === form.id ? form : r)) : [...prev, form];
    });
    setModal(null);
  };
  const remove = async (id) => {
    const ok = await ask({ title: `Delete ${title.slice(0,-1)}?`, message: "This record will be permanently deleted.", confirmLabel: "Delete", danger: true });
    if (ok) setRecords((prev) => prev.filter((r) => r.id !== id));
  };
  const sorted = useMemo(() => {
    let list = [...records].sort((a, b) => (a.date < b.date ? 1 : -1));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
    }
    return list;
  }, [records, search]);
  const total = sorted.reduce((s, r) => s + Number(r[amountKey] || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {Dialog}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--ink)] flex items-center gap-2"><Icon size={18} style={{ color }} />{title}</h2>
        <div className="flex items-center gap-3">
          {amountKey && <span className="text-sm font-mono text-[var(--muted)]">Total {fmtMoney(total, currency)}</span>}
          <Button onClick={() => setModal({ mode: "new" })}><Plus size={16} />Add</Button>
        </div>
      </div>
      <Card className="overflow-x-auto">
        {sorted.length === 0 ? <EmptyState label={`No ${title.toLowerCase()} recorded yet.`} /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)]">
                {fields.map((f) => <th key={f.key} className="p-3">{f.label}</th>)}
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--hover)]">
                  {fields.map((f) => (
                    <td key={f.key} className="p-3">
                      {f.type === "number" ? <span className="font-mono">{fmtMoney(r[f.key], currency)}</span> :
                       f.key === "date" ? <span className="font-mono text-xs">{r[f.key]}</span> : (r[f.key] || "â€”")}
                    </td>
                  ))}
                  <td className="p-3 text-right whitespace-nowrap">
                    <button onClick={() => setModal({ mode: "edit", data: r })} className="text-[var(--muted)] hover:text-[var(--ink)] mr-2"><Edit2 size={14} /></button>
                    <button onClick={() => remove(r.id)} className="text-[var(--muted)] hover:text-[var(--danger)]"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === "edit" ? `Edit ${title.slice(0, -1)}` : `Add ${title.slice(0, -1)}`}>
        <div className="flex flex-col gap-3">
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.type === "select" ? (
                <select className={inputCls} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea className={inputCls} rows={2} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              ) : (
                <input
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  className={inputCls}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              )}
            </Field>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------------------------- Calendar ---------------------------------- */

function CalendarView({ reports, leaves, fines, payments, expenses }) {
  const [cursor, setCursor] = useState(new Date());
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const eventsByDate = useMemo(() => {
    const map = {};
    const push = (date, type) => { if (!map[date]) map[date] = new Set(); map[date].add(type); };
    reports.forEach((r) => push(r.date, "work"));
    leaves.forEach((l) => push(l.date, "leave"));
    fines.forEach((f) => push(f.date, "fine"));
    payments.forEach((p) => push(p.date, "salary"));
    expenses.forEach((e) => push(e.date, "expense"));
    return map;
  }, [reports, leaves, fines, payments, expenses]);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--ink)]">Calendar</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-[var(--hover)]"><ChevronLeft size={16} /></button>
          <span className="text-sm font-medium w-32 text-center">{monthLabel}</span>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-[var(--hover)]"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="flex gap-3 flex-wrap text-xs text-[var(--muted)]">
        {Object.entries(CAL_COLORS).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />{k}</span>
        ))}
      </div>
      <Card className="p-4">
        <div className="grid grid-cols-7 gap-2 text-xs text-[var(--muted)] mb-2 text-center">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const evs = eventsByDate[dateStr];
            const isToday = dateStr === todayStr();
            return (
              <div key={i} className={`aspect-square rounded-xl border p-1.5 flex flex-col ${isToday ? "border-[var(--accent)]" : "border-[var(--line)]"}`}>
                <span className={`text-xs ${isToday ? "text-[var(--accent)] font-semibold" : "text-[var(--ink)]"}`}>{d}</span>
                <div className="flex flex-wrap gap-0.5 mt-auto">
                  {evs && [...evs].map((t) => <span key={t} className="w-1.5 h-1.5 rounded-full" style={{ background: CAL_COLORS[t] }} />)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------- Analytics ---------------------------------- */

function AnalyticsView({ reports, expenses, fines, payments, currency, settings }) {
  const last14 = useMemo(() => {
    const out = [];
    for (let i = 13; i >= 0; i--) {
      const d = daysAgoStr(i);
      const dayReports = reports.filter((r) => r.date === d);
      out.push({
        date: d.slice(5),
        hours: round2(dayReports.reduce((s, r) => s + Number(r.hours || 0), 0)),
        salary: round2(dayReports.reduce((s, r) => s + Number(r.salary || 0), 0)),
      });
    }
    return out;
  }, [reports]);

  const last6mo = useMemo(() => {
    const out = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthReports = reports.filter((r) => r.date.startsWith(key));
      out.push({ month: d.toLocaleDateString("en-US", { month: "short" }), salary: round2(monthReports.reduce((s, r) => s + Number(r.salary || 0), 0)) });
    }
    return out;
  }, [reports]);

  const expenseByCat = useMemo(() => {
    const map = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + Number(e.amount || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const PIE_COLORS = ["#4d7cfe", "#3ecf8e", "#e6b325", "#e5484d", "#a970ff", "#f78166", "#57c7d4", "#8a8f98"];

  const allMonthsData = useMemo(() => {
    const monthMap = {};
    const track = (d) => {
      if (!d) return;
      const m = d.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { month: m, gross: 0, fines: 0, expenses: 0, net: 0, paid: 0, crDates: [] };
    };
    if (settings.joiningDate) track(settings.joiningDate);
    reports.forEach((r) => { track(r.date); monthMap[r.date.slice(0, 7)].gross += Number(r.salary || 0); });
    fines.forEach((r) => { track(r.date); monthMap[r.date.slice(0, 7)].fines += Number(r.amount || 0); });
    expenses.forEach((r) => { track(r.date); monthMap[r.date.slice(0, 7)].expenses += Number(r.amount || 0); });
    payments.forEach((r) => { 
      track(r.date); 
      const m = monthMap[r.date.slice(0, 7)];
      m.paid += Number(r.amount || 0); 
      if (!m.crDates.includes(r.date)) m.crDates.push(r.date);
    });

    return Object.values(monthMap).map((m) => {
      m.net = round2(m.gross - m.fines - m.expenses);
      m.paid = round2(m.paid);
      m.pending = round2(m.net - m.paid);
      return m;
    }).sort((a, b) => (b.month.localeCompare(a.month)));
  }, [reports, fines, expenses, payments, settings.joiningDate]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-[var(--ink)]">Analytics</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-sm font-medium text-[var(--ink)] mb-3">Hours â€” last 14 days</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={last14}>
              <defs><linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3ecf8e" stopOpacity={0.4} /><stop offset="100%" stopColor="#3ecf8e" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="hours" stroke="#3ecf8e" fill="url(#h)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-[var(--ink)] mb-3">Salary â€” last 6 months</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={last6mo}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMoney(v, currency)} />
              <Bar dataKey="salary" fill="#4d7cfe" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-[var(--ink)] mb-3">Expense breakdown</div>
          {expenseByCat.length === 0 ? <EmptyState label="No expenses yet" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={expenseByCat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {expenseByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtMoney(v, currency)} contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-[var(--ink)] mb-3">Hourly salary trend</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={last14}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMoney(v, currency)} />
              <Line type="monotone" dataKey="salary" stroke="#e6b325" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <h2 className="text-lg font-semibold text-[var(--ink)] mt-4">Past Months & Years Data</h2>
      <Card className="overflow-x-auto">
        {allMonthsData.length === 0 ? <EmptyState label="No monthly data available." /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)]">
                <th className="p-3">Month</th><th className="p-3">Gross</th><th className="p-3">Deductions</th>
                <th className="p-3">Net</th><th className="p-3">Paid (Salary CR)</th><th className="p-3">CR Dates</th><th className="p-3">Pending</th>
              </tr>
            </thead>
            <tbody>
              {allMonthsData.map((m) => (
                <tr key={m.month} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--hover)]">
                  <td className="p-3 font-medium text-[var(--ink)]">{m.month}</td>
                  <td className="p-3 font-mono text-[var(--muted)]">{fmtMoney(m.gross, currency)}</td>
                  <td className="p-3 font-mono text-[var(--danger)]">{fmtMoney(round2(m.fines + m.expenses), currency)}</td>
                  <td className="p-3 font-mono">{fmtMoney(m.net, currency)}</td>
                  <td className="p-3 font-mono text-[var(--work)]">{fmtMoney(m.paid, currency)}</td>
                  <td className="p-3 text-xs text-[var(--muted)]">{m.crDates.join(", ") || "â€”"}</td>
                  <td className="p-3 font-mono">{fmtMoney(m.pending, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------- Reports ---------------------------------- */

function reportPeriods() {
  const t = todayStr();
  const weekStart = daysAgoStr(6);
  const monthStart = t.slice(0, 8) + "01";
  const yearStart = t.slice(0, 4) + "-01-01";
  return {
    "Today": [t, t],
    "This week": [weekStart, t],
    "This month": [monthStart, t],
    "Last 45 days": [daysAgoStr(45), t],
    "This year": [yearStart, t],
  };
}

function ReportsView({ reports, leaves, fines, expenses, payments, currency, settings }) {
  const presets = reportPeriods();
  const [range, setRange] = useState("Last 45 days");
  const [from, setFrom] = useState(presets["Last 45 days"][0]);
  const [to, setTo] = useState(presets["Last 45 days"][1]);

  const choosePreset = (name) => {
    setRange(name);
    setFrom(presets[name][0]);
    setTo(presets[name][1]);
  };

  const wr = reports.filter((r) => inRange(r.date, from, to));
  const lv = leaves.filter((l) => inRange(l.date, from, to));
  const fn = fines.filter((f) => inRange(f.date, from, to));
  const ex = expenses.filter((e) => inRange(e.date, from, to));
  const pay = payments.filter((p) => inRange(p.date, from, to));

  const { gross, totalFine, totalExpense, totalHours, net: netSalary } = netSalaryFor(reports, fines, expenses, from, to);
  const totalPaid = round2(pay.reduce((s, r) => s + Number(r.amount || 0), 0));
  const pending = round2(netSalary - totalPaid);

  const exportCSV = () => {
    const rows = [["Date", "Project", "Task", "Hours", "Salary", "Status"]];
    wr.forEach((r) => rows.push([r.date, r.project, r.task, r.hours, r.salary, r.status]));
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `workflow-pro-report-${from}_to_${to}.csv`;
    a.click();
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [["Date", "Project", "Task", "Hours", "Salary", "Status", "Priority", "Notes"]];
    wr.forEach((r) => wsData.push([r.date, r.project, r.task, r.hours, r.salary, r.status, r.priority, r.notes]));
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Work Reports");

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ["WorkFlow Pro â€” Salary Report"],
      ["Employee", settings.employeeName],
      ["Period", `${from} to ${to}`],
      [],
      ["Working days", wr.length],
      ["Total hours", totalHours],
      ["Gross salary", gross],
      ["Fines", totalFine],
      ["Expenses", totalExpense],
      ["Net salary", netSalary],
      ["Paid", totalPaid],
      ["Pending", pending],
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
    XLSX.writeFile(wb, `workflow-pro-report-${from}_to_${to}.xlsx`);
  };

  const printReport = () => window.print();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-[var(--ink)]">Reports</h2>
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          {Object.keys(presets).map((p) => (
            <button key={p} onClick={() => choosePreset(p)} className={`text-xs px-3 py-1.5 rounded-full border ${range === p ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--line)] text-[var(--muted)] hover:bg-[var(--hover)]"}`}>{p}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" className={inputCls} value={from} onChange={(e) => { setFrom(e.target.value); setRange("Custom"); }} />
          <span className="text-[var(--muted)] text-xs">to</span>
          <input type="date" className={inputCls} value={to} onChange={(e) => { setTo(e.target.value); setRange("Custom"); }} />
        </div>
      </Card>

      <div className="flex flex-col gap-4 print-area">
        <div className="hidden print:flex flex-col mb-2">
          <div className="text-xl font-bold">{settings.company}</div>
          <div className="text-sm">{settings.employeeName} &middot; Report period {from} to {to} &middot; Generated {todayStr()}</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Working days" value={wr.length} icon={CheckCircle2} tint={CAL_COLORS.work} />
          <StatCard label="Total hours" value={`${totalHours}h`} icon={Clock} tint={CAL_COLORS.salary} />
          <StatCard label="Gross salary" value={fmtMoney(gross, currency)} icon={IndianRupee} tint={CAL_COLORS.salary} />
          <StatCard label="Net salary" value={fmtMoney(netSalary, currency)} icon={CircleDollarSign} tint={CAL_COLORS.work} />
          <StatCard label="Fines" value={fmtMoney(totalFine, currency)} icon={AlertTriangle} tint={CAL_COLORS.fine} />
          <StatCard label="Expenses" value={fmtMoney(totalExpense, currency)} icon={Receipt} tint={CAL_COLORS.expense} />
          <StatCard label="Paid" value={fmtMoney(totalPaid, currency)} icon={Wallet} tint={CAL_COLORS.work} />
          <StatCard label="Pending" value={fmtMoney(pending, currency)} icon={TrendingUp} tint={CAL_COLORS.leave} />
        </div>
        <Card className="overflow-x-auto">
          {wr.length === 0 ? <EmptyState label="No work entries in this period." /> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)]">
                  <th className="p-3">Date</th><th className="p-3">Project</th><th className="p-3">Task</th><th className="p-3">Hours</th><th className="p-3">Salary</th>
                </tr>
              </thead>
              <tbody>
                {wr.sort((a, b) => (a.date < b.date ? 1 : -1)).map((r) => (
                  <tr key={r.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="p-3 font-mono text-xs">{r.date}</td><td className="p-3">{r.project}</td><td className="p-3">{r.task}</td>
                    <td className="p-3 font-mono">{r.hours}h</td><td className="p-3 font-mono">{fmtMoney(r.salary, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="flex gap-2 print:hidden">
        <Button variant="outline" onClick={exportCSV}><Download size={15} />Export CSV</Button>
        <Button variant="outline" onClick={exportExcel}><FileSpreadsheet size={15} />Export Excel</Button>
        <Button variant="outline" onClick={printReport}><Printer size={15} />Print / Save as PDF</Button>
      </div>
    </div>
  );
}

/* ---------------------------------- Employment History ---------------------------------- */

function EmploymentHistoryManager({ history = [], onChange, disabled }) {
  const [items, setItems] = useState(history || []);
  const [newItem, setNewItem] = useState({ date: todayStr(), event: "Promotion", designation: "", company: "", notes: "" });

  useEffect(() => setItems(history || []), [history]);

  const add = () => {
    const next = [...items, { ...newItem, id: uid() }].sort((a, b) => (a.date > b.date ? -1 : 1));
    setItems(next);
    onChange(next);
    setNewItem({ date: todayStr(), event: "Promotion", designation: "", company: "", notes: "" });
  };
  const remove = (id) => {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Employment History</div>
      {!disabled && (
        <div className="flex flex-col gap-2 border border-[var(--line)] p-3 rounded-lg bg-[var(--bg)]">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Field label="Date"><input type="date" className={inputCls} value={newItem.date} onChange={(e) => setNewItem({ ...newItem, date: e.target.value })} /></Field>
            <Field label="Event">
              <select className={inputCls} value={newItem.event} onChange={(e) => setNewItem({ ...newItem, event: e.target.value })}>
                <option>Promotion</option><option>Demotion</option><option>Role Change</option><option>Company Change</option>
              </select>
            </Field>
            <Field label="Designation"><input className={inputCls} value={newItem.designation} onChange={(e) => setNewItem({ ...newItem, designation: e.target.value })} /></Field>
            <Field label="Company"><input className={inputCls} value={newItem.company} onChange={(e) => setNewItem({ ...newItem, company: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><input className={inputCls} value={newItem.notes} onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })} /></Field>
          <Button onClick={add} variant="outline" className="mt-1 w-full justify-center">Add Event</Button>
        </div>
      )}
      <div className="flex flex-col gap-3 mt-2">
        {items.length === 0 ? <div className="text-xs text-[var(--muted)]">No history logged yet.</div> : items.map((ev) => (
          <div key={ev.id} className="relative flex flex-col gap-1 text-sm border-l-2 border-[var(--accent)] pl-3 py-1 bg-[var(--hover)]/30 rounded-r-lg">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--ink)]">{ev.event}</span>
              <span className="text-xs font-mono text-[var(--muted)]">{ev.date}</span>
            </div>
            <div className="text-xs text-[var(--muted)]"><span className="font-medium text-[var(--ink)]">Designation:</span> {ev.designation || "â€”"} &middot; <span className="font-medium text-[var(--ink)]">Company:</span> {ev.company || "â€”"}</div>
            {ev.notes && <div className="text-xs text-[var(--ink)] mt-1">{ev.notes}</div>}
            {!disabled && <button onClick={() => remove(ev.id)} className="absolute top-1.5 -left-[9px] w-4 h-4 bg-[var(--panel)] border border-[var(--danger)] text-[var(--danger)] rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity" title="Remove"><X size={10} /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- Settings / Profile ---------------------------------- */

function SettingsView({ user, onUpdateUser, prefs, setPrefs, canEditPayroll, isOwnAccount, onLogout }) {
  const [f, setF] = useState(user);
  useEffect(() => setF(user), [user]);
  const [p, setP] = useState(prefs);
  useEffect(() => setP(prefs), [prefs]);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");
  const { ask, Dialog } = useConfirm();

  const savePw = async () => {
    setPwMsg("");
    if (pw.next.length < 6) { setPwMsg("New password must be at least 6 characters."); return; }
    if (pw.next !== pw.confirm) { setPwMsg("New passwords do not match."); return; }
    const currentHash = await hashPassword(pw.current);
    if (currentHash !== user.passwordHash) { setPwMsg("Current password is incorrect."); return; }
    const newHash = await hashPassword(pw.next);
    onUpdateUser({ passwordHash: newHash });
    setPw({ current: "", next: "", confirm: "" });
    setPwMsg("Password updated.");
  };

  const rawTheme = p.theme || "dark";
  const cycleTheme = () => {
    const next = rawTheme === "dark" ? "light" : rawTheme === "light" ? "system" : "dark";
    const updated = { ...p, theme: next };
    setP(updated);
    setPrefs(updated);
  };
  const themeLabel = rawTheme === "light" ? "Light" : rawTheme === "system" ? "System Default" : "Dark";
  const themeNextLabel = rawTheme === "dark" ? "Light" : rawTheme === "light" ? "System Default" : "Dark";
  const ThemeIcon = rawTheme === "light" ? Sun : rawTheme === "system" ? Monitor : Moon;

  const handleResign = async () => {
    const ok = await ask({ title: "Submit Resignation?", message: "This will notify your admin. Your account stays active until they approve.", confirmLabel: "Submit", danger: true });
    if (ok) onUpdateUser({ resignationStatus: "Requested", resignationReason: f.resignationReason });
  };

  const handleLogout = async () => {
    const ok = await ask({ title: "Log out?", message: "You will be signed out of WorkFlow Pro.", confirmLabel: "Log out" });
    if (ok) onLogout();
  };

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      {Dialog}
      <h2 className="text-lg font-semibold text-[var(--ink)]">Profile & Settings</h2>
      <Card className="p-4 flex flex-col gap-3">
        <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Profile</div>
        <Field label="Full name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} onBlur={() => onUpdateUser({ name: f.name })} /></Field>
        <Field label="Email (login)"><input className={inputCls} value={f.email} disabled /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className={inputCls} value={f.phone || ""} onChange={(e) => setF({ ...f, phone: e.target.value })} onBlur={() => onUpdateUser({ phone: f.phone })} /></Field>
          <Field label="Department"><input className={inputCls} value={f.department || ""} onChange={(e) => setF({ ...f, department: e.target.value })} onBlur={() => onUpdateUser({ department: f.department })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Designation"><input className={inputCls} value={f.designation || ""} onChange={(e) => setF({ ...f, designation: e.target.value })} onBlur={() => onUpdateUser({ designation: f.designation })} /></Field>
          <Field label="Location"><input className={inputCls} value={f.location || ""} onChange={(e) => setF({ ...f, location: e.target.value })} onBlur={() => onUpdateUser({ location: f.location })} /></Field>
        </div>
      </Card>

      <Card className="p-4 flex flex-col gap-3">
        <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Employment History</div>
        <EmploymentHistoryTimeline history={f.employmentHistory || []} />
      </Card>

      <Card className="p-4 flex flex-col gap-3">
        <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Payroll {!canEditPayroll && "(managed by admin)"}</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hourly rate"><input type="number" disabled={!canEditPayroll} className={inputCls} value={f.hourlyRate} onChange={(e) => setF({ ...f, hourlyRate: Number(e.target.value) })} onBlur={() => onUpdateUser({ hourlyRate: Number(f.hourlyRate) })} /></Field>
          <Field label="Currency symbol"><input className={inputCls} value={p.currency} onChange={(e) => setP({ ...p, currency: e.target.value })} onBlur={() => setPrefs(p)} /></Field>
        </div>
        <Field label="Company"><input disabled={!canEditPayroll} className={inputCls} value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} onBlur={() => onUpdateUser({ company: f.company })} /></Field>
        <Field label="Joining date"><input type="date" disabled={!canEditPayroll} className={inputCls} value={f.joiningDate} onChange={(e) => setF({ ...f, joiningDate: e.target.value })} onBlur={() => onUpdateUser({ joiningDate: f.joiningDate })} /></Field>
        <Field label="Salary pay day (day of month)"><input type="number" min="1" max="31" className={inputCls} value={p.payDay} onChange={(e) => setP({ ...p, payDay: Number(e.target.value) })} onBlur={() => setPrefs(p)} /></Field>
      </Card>

      <Card className="p-4 flex flex-col gap-3">
        <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Appearance</div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--ink)]">Theme: <span className="font-medium">{themeLabel}</span></span>
          <button onClick={cycleTheme} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--line)] text-sm text-[var(--ink)] hover:bg-[var(--hover)] transition-colors">
            <ThemeIcon size={14} /> Switch to {themeNextLabel}
          </button>
        </div>
      </Card>

      {isOwnAccount && (
        <Card className="p-4 flex flex-col gap-3">
          <div className="text-xs uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5"><KeyRound size={13} />Change password</div>
          <Field label="Current password"><input type="password" className={inputCls} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label="New password"><input type="password" className={inputCls} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          <Field label="Confirm new password"><input type="password" className={inputCls} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
          {pwMsg && <div className="text-xs text-[var(--muted)]">{pwMsg}</div>}
          <div className="flex justify-end"><Button variant="outline" onClick={savePw}>Update password</Button></div>
        </Card>
      )}

      {isOwnAccount && (
        <Card className="p-4 flex flex-col gap-3 border-dashed border-[var(--danger)]/30">
          <div className="text-xs uppercase tracking-wider text-[var(--danger)] font-medium">Resignation</div>
          {user.resignationStatus === "Requested" && (
            <div className="text-sm bg-[var(--danger)]/10 text-[var(--danger)] p-3 rounded-lg border border-[var(--danger)]/20">
              You requested resignation. Waiting for admin approval.
              <div className="mt-1 opacity-80">Reason: {user.resignationReason}</div>
            </div>
          )}
          {user.resignationStatus === "Approved" && (
            <div className="text-sm bg-[var(--danger)]/10 text-[var(--danger)] p-3 rounded-lg border border-[var(--danger)]/20">
              Your resignation has been approved. You are no longer active.
              <div className="mt-1 opacity-80">Admin notes: {user.adminResignationNotes}</div>
            </div>
          )}
          {!user.resignationStatus && (
            <>
              <div className="text-sm text-[var(--muted)]">If you wish to resign, provide a reason below and submit the request to your admin.</div>
              <Field label="Reason for resignation (Compulsory)"><textarea className={inputCls} rows={2} value={f.resignationReason || ""} onChange={(e) => setF({ ...f, resignationReason: e.target.value })} /></Field>
              <div className="flex justify-end">
                <Button variant="danger" disabled={!f.resignationReason?.trim()} onClick={handleResign}>Submit Resignation Request</Button>
              </div>
            </>
          )}
        </Card>
      )}

      {isOwnAccount && (
        <Button variant="danger" onClick={handleLogout} className="justify-center"><LogOut size={15} />Log out</Button>
      )}
    </div>
  );
}

/* ---------------------------------- Admin ---------------------------------- */

function AdminView({ users, setUsers, currentUser, search = "", onViewAs, onSendNotification }) {
  const [employeeData, setEmployeeData] = useState({});
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // mode: "new"|"edit"|"promote"|"demote"|"notify"
  const [resetModal, setResetModal] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const { ask, Dialog } = useConfirm();

  const loadAll = async () => {
    setLoading(true);
    const map = {};
    for (const u of users) {
      const obj = {};
      for (const k of ["reports", "fines", "expenses", "payments", "leaves"]) {
        try {
          const r = await window.storage.get(dataKey(u.id, k), true);
          obj[k] = r ? JSON.parse(r.value) : [];
        } catch (e) {
          obj[k] = [];
        }
      }
      map[u.id] = obj;
    }
    setEmployeeData(map);
    setLoading(false);
  };
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [users.length]);

  const t = todayStr();
  const monthStart = t.slice(0, 8) + "01";

  const rows = useMemo(() => {
    let list = users.map((u) => {
      const d = employeeData[u.id] || { reports: [], fines: [], expenses: [], payments: [] };
      const { totalHours, net } = netSalaryFor(d.reports, d.fines, d.expenses, monthStart, t);
      const paid = round2((d.payments || []).filter((p) => inRange(p.date, monthStart, t)).reduce((s, p) => s + Number(p.amount || 0), 0));
      const allTime = netSalaryFor(d.reports, d.fines, d.expenses, "0000-01-01", t);
      const allTimePaid = round2((d.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0));
      return { user: u, monthHours: totalHours, monthNet: net, monthPaid: paid, pending: round2(allTime.net - allTimePaid) };
    });
    
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(({ user }) => 
        user.name.toLowerCase().includes(q) || 
        user.email.toLowerCase().includes(q) ||
        user.role.toLowerCase().includes(q) ||
        (user.designation && user.designation.toLowerCase().includes(q))
      );
    }
    return list;
  }, [users, employeeData, monthStart, t, search]);

  const totals = rows.reduce((acc, r) => ({
    hours: round2(acc.hours + r.monthHours),
    net: round2(acc.net + r.monthNet),
    pending: round2(acc.pending + r.pending),
  }), { hours: 0, net: 0, pending: 0 });

  const blankForm = { id: uid(), name: "", email: "", password: "", role: "employee", hourlyRate: 0, currency: "₹", company: "Freelance", department: "", phone: "", designation: "", location: "", history: "", employmentHistory: [], joiningDate: todayStr(), active: true };
  const [form, setForm] = useState(blankForm);
  const [promotionForm, setPromotionForm] = useState({ event: "Promotion", date: todayStr(), designation: "", department: "", company: "", notes: "" });
  const [notifForm, setNotifForm] = useState({ title: "", message: "" });

  useEffect(() => {
    if (modal?.mode === "edit") setForm({ ...blankForm, ...modal.data });
    if (modal?.mode === "new") setForm(blankForm);
    if (modal?.mode === "promote") setPromotionForm({ event: "Promotion", date: todayStr(), designation: modal.data?.designation || "", department: modal.data?.department || "", company: modal.data?.company || "", notes: "" });
    if (modal?.mode === "demote") setPromotionForm({ event: "Demotion", date: todayStr(), designation: "", department: "", company: "", notes: "" });
    if (modal?.mode === "notify") setNotifForm({ title: "", message: "" });
  }, [modal]);

  const saveEmployee = async () => {
    if (modal.mode === "new") {
      if (!form.name.trim() || !form.email.trim() || !form.password) return;
      if (users.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase())) return;
      const hash = await hashPassword(form.password);
      const newUser = { ...form, id: uid(), email: form.email.trim(), passwordHash: hash };
      delete newUser.password;
      setUsers((prev) => [...prev, newUser]);
    } else {
      setUsers((prev) => prev.map((u) => (u.id === form.id ? { ...u, ...form } : u)));
    }
    setModal(null);
  };

  const submitPromotion = () => {
    const target = modal.data;
    const historyEvent = { id: uid(), ...promotionForm };
    const updates = { employmentHistory: [...(target.employmentHistory || []), historyEvent] };
    if (promotionForm.designation) updates.designation = promotionForm.designation;
    if (promotionForm.department) updates.department = promotionForm.department;
    if (promotionForm.company) updates.company = promotionForm.company;
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, ...updates } : u)));
    setModal(null);
  };

  const submitNotification = async () => {
    if (!notifForm.title.trim() || !notifForm.message.trim()) return;
    
    if (modal.mode === "bulkNotify") {
      for (const uid of selectedUsers) {
        await onSendNotification(uid, { ...notifForm, id: uid(), date: todayStr(), read: false });
      }
      setSelectedUsers([]);
    } else {
      await onSendNotification(modal.data.id, { ...notifForm, id: uid(), date: todayStr(), read: false });
    }
    setModal(null);
  };

  const toggleActive = async (u) => {
    const ok = await ask({ title: u.active ? "Deactivate Account?" : "Activate Account?", message: u.active ? `${u.name}'s account will be disabled.` : `${u.name}'s account will be re-enabled.`, confirmLabel: u.active ? "Deactivate" : "Activate", danger: u.active });
    if (ok) setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)));
  };
  const removeUser = async (u) => {
    if (u.id === currentUser.id) return;
    const ok = await ask({ title: "Delete Employee?", message: `${u.name}'s account and data will be permanently removed.`, confirmLabel: "Delete", danger: true });
    if (ok) setUsers((prev) => prev.filter((x) => x.id !== u.id));
  };

  const [resetPw, setResetPw] = useState("");
  const doReset = async () => {
    if (resetPw.length < 6) return;
    const ok = await ask({ title: "Reset Password?", message: `Share the new password directly with ${resetModal?.name}.`, confirmLabel: "Reset" });
    if (!ok) return;
    const hash = await hashPassword(resetPw);
    setUsers((prev) => prev.map((u) => (u.id === resetModal.id ? { ...u, passwordHash: hash } : u)));
    setResetPw("");
    setResetModal(null);
  };

  const submitPayment = async () => {
    if (!payModal || !payModal.amount) return;
    
    if (payModal.mode === "bulk") {
      const ok = await ask({ title: "Bulk Credit Salary?", message: `Credit ${payModal.amount} to ${selectedUsers.length} employees?`, confirmLabel: "Credit All" });
      if (!ok) return;
      for (const uid of selectedUsers) {
        const key = dataKey(uid, "payments");
        let current = [];
        try {
          const res = await window.storage.get(key, true);
          if (res && res.value) current = JSON.parse(res.value);
        } catch(e) {}
        current.push({ id: uid(), date: payModal.date, amount: Number(payModal.amount), transactionId: "Admin Bulk Credit", notes: payModal.notes });
        await window.storage.set(key, JSON.stringify(current), true);
      }
      setSelectedUsers([]);
    } else {
      const ok = await ask({ title: "Credit Salary?", message: `Credit ${fmtMoney(payModal.amount, payModal.user.currency || "₹")} to ${payModal.user.name}?`, confirmLabel: "Credit" });
      if (!ok) return;
      const key = dataKey(payModal.user.id, "payments");
      let current = [];
      try {
        const res = await window.storage.get(key, true);
        if (res && res.value) current = JSON.parse(res.value);
      } catch(e) {}
      current.push({ id: uid(), date: payModal.date, amount: Number(payModal.amount), transactionId: "Admin Manual Credit", notes: payModal.notes });
      await window.storage.set(key, JSON.stringify(current), true);
    }
    
    setPayModal(null);
    loadAll();
  };

  return (
    <div className="flex flex-col gap-4">
      {Dialog}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--ink)] flex items-center gap-2"><ShieldCheck size={18} className="text-[var(--accent)]" />Admin — Employee Management</h2>
        <div className="flex gap-2">
          {selectedUsers.length > 0 && (
            <div className="flex items-center gap-2 bg-[var(--accent)]/10 text-[var(--accent)] px-3 py-1.5 rounded-lg border border-[var(--accent)]/20 mr-2">
              <span className="text-sm font-medium">{selectedUsers.length} selected</span>
              <button onClick={() => setModal({ mode: "bulkNotify" })} className="p-1 hover:bg-[var(--accent)]/20 rounded ml-1" title="Bulk Send Message"><Send size={14} /></button>
              <button onClick={() => setPayModal({ mode: "bulk", amount: "", date: todayStr(), notes: "Admin Bulk Credit" })} className="p-1 hover:bg-[var(--accent)]/20 rounded" title="Bulk Credit Salary"><Wallet size={14} /></button>
            </div>
          )}
          <Button variant="outline" onClick={async () => {
            const ok = await ask({ title: "Seed Massive Dummy Data?", message: "This will create multiple employees and 6 months of robust data (reports, expenses, fines, leaves, history, payments) for testing.", confirmLabel: "Seed Everything", danger: true });
            if (!ok) return;

            const pw = await hashPassword("password");
            const dummyUsers = [
              { id: uid(), name: "Alice Smith", email: "alice@example.com", passwordHash: pw, role: "employee", hourlyRate: 350, currency: "₹", company: "Acme Corp", department: "Design", designation: "Senior Designer", joiningDate: "2023-01-15", active: true, employmentHistory: [{ id: uid(), event: "Promotion", date: daysAgoStr(45), designation: "Senior Designer", department: "Design", notes: "Promoted for excellent work." }] },
              { id: uid(), name: "Bob Jones", email: "bob@example.com", passwordHash: pw, role: "employee", hourlyRate: 250, currency: "₹", company: "Acme Corp", department: "Engineering", designation: "Frontend Developer", joiningDate: "2023-05-10", active: true, employmentHistory: [] },
              { id: uid(), name: "Charlie Davis", email: "charlie@example.com", passwordHash: pw, role: "employee", hourlyRate: 300, currency: "₹", company: "Acme Europe", department: "Marketing", designation: "Marketing Specialist", joiningDate: "2023-08-01", active: true, employmentHistory: [] }
            ];
            // Generate 6 months of data for each user
            for (const u of dummyUsers) {
              const reports = [];
              const expenses = [];
              const leaves = [];
              const fines = [];
              const payments = [];
              let monthlyNet = {}; // tracking to simulate salary payments

              const projects = ["Acme Website", "Mobile App v2", "Internal Dashboard", "Client Portal", "API Integration", "Marketing Campaign"];
              const tasks = ["Frontend Dev", "Backend Dev", "UI/UX Design", "Testing & QA", "Client Meeting", "Code Review", "Bug Fixing", "Deployment"];
              const expCategories = ["Travel", "Office", "Software", "Food", "Internet", "Other"];
              const expNotes = ["Client visit to NY", "AWS Subscription", "Team Lunch", "Office Supplies", "New Keyboard", "Taxi fare", "Internet Bill"];
              const fineReasons = ["Late arrival", "Forgot ID card", "Missed deadline", "Dress code violation"];
              const locations = ["New York HQ", "Remote - Home", "London Office", "Client Site A", "Client Site B", "San Francisco Branch"];

              for (let i = 180; i >= 0; i--) {
                const d = daysAgoStr(i);
                const monthStr = d.slice(0, 7);
                if (!monthlyNet[monthStr]) monthlyNet[monthStr] = 0;
                
                const dayOfWeek = new Date(d).getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                if (!isWeekend) {
                  // 90% chance to work
                  if (Math.random() > 0.1) {
                    const hrs = 6 + Math.floor(Math.random() * 4); // 6 to 9 hours
                    const sal = hrs * u.hourlyRate;
                    const proj = projects[Math.floor(Math.random() * projects.length)];
                    const task = tasks[Math.floor(Math.random() * tasks.length)];
                    const loc = locations[Math.floor(Math.random() * locations.length)];
                    reports.push({ id: uid(), date: d, project: proj, task: task, hours: hrs, salary: sal, status: "Completed", notes: `Worked from ${loc}` });
                    monthlyNet[monthStr] += sal;
                  } else {
                    // 10% chance for leave on a weekday
                    const type = Math.random() > 0.5 ? "Sick Leave" : "Casual Leave";
                    leaves.push({ id: uid(), date: d, type, reason: "Feeling unwell or personal work", notes: "" });
                  }
                }

                // Random expenses (3% chance)
                if (Math.random() < 0.03) {
                  const amt = 20 + Math.floor(Math.random() * 80);
                  const cat = expCategories[Math.floor(Math.random() * expCategories.length)];
                  const note = expNotes[Math.floor(Math.random() * expNotes.length)];
                  expenses.push({ id: uid(), date: d, category: cat, amount: amt, notes: note });
                  monthlyNet[monthStr] -= amt;
                }
                
                // Random fines (1% chance)
                if (Math.random() < 0.01) {
                  const amt = 10 + Math.floor(Math.random() * 20);
                  const reason = fineReasons[Math.floor(Math.random() * fineReasons.length)];
                  fines.push({ id: uid(), date: d, reason: reason, amount: amt, notes: "" });
                  monthlyNet[monthStr] -= amt;
                }
                
                // Salary Payment at end of month (approx 28th)
                if (d.endsWith("-28")) {
                  const payAmount = Math.max(0, monthlyNet[monthStr] * 0.9); // pay 90% of what's owed so far
                  if (payAmount > 0) {
                     payments.push({ id: uid(), date: d, amount: payAmount, transactionId: `TXN-${Math.floor(Math.random()*10000)}`, mode: "Bank Transfer", notes: "Monthly Salary" });
                     monthlyNet[monthStr] -= payAmount;
                  }
                }
              }

              await window.storage.set(dataKey(u.id, "reports"), JSON.stringify(reports), true);
              await window.storage.set(dataKey(u.id, "expenses"), JSON.stringify(expenses), true);
              await window.storage.set(dataKey(u.id, "leaves"), JSON.stringify(leaves), true);
              await window.storage.set(dataKey(u.id, "fines"), JSON.stringify(fines), true);
              await window.storage.set(dataKey(u.id, "payments"), JSON.stringify(payments), true);
              await window.storage.set(dataKey(u.id, "notifications"), JSON.stringify([{ id: uid(), date: todayStr(), title: "Welcome!", message: "Your account is set up.", read: false }]), true);
            }
            
            // Now that all data is securely written, add users to state
            // This will trigger AdminView to re-load with the new users and populated data
            setUsers(prev => [...prev, ...dummyUsers]);
          }}><Database size={15} />Seed Massive Data</Button>
          <Button variant="outline" onClick={loadAll} disabled={loading}><RefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh</Button>
          <Button onClick={() => setModal({ mode: "new" })}><UserPlus size={16} />Add employee</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Employees" value={users.length} icon={Users} tint={CAL_COLORS.salary} />
        <StatCard label="Hours this month" value={`${totals.hours}h`} icon={Clock} tint={CAL_COLORS.work} />
        <StatCard label="Net payroll (mo)" value={fmtMoney(totals.net, currentUser.currency || "\u20b9")} icon={IndianRupee} tint={CAL_COLORS.salary} />
        <StatCard label="Pending across all" value={fmtMoney(totals.pending, currentUser.currency || "\u20b9")} icon={CircleDollarSign} tint={CAL_COLORS.leave} />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)]">
              <th className="p-3 w-8">
                <input 
                  type="checkbox" 
                  checked={rows.length > 0 && selectedUsers.length === rows.length}
                  onChange={(e) => setSelectedUsers(e.target.checked ? rows.map(r => r.user.id) : [])}
                  className="rounded border-[var(--line)]"
                />
              </th>
              <th className="p-3">Employee</th><th className="p-3">Role</th><th className="p-3">Rate</th><th className="p-3">Status</th>
              <th className="p-3">Hours (mo)</th><th className="p-3">Net (mo)</th><th className="p-3">Pending</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ user, monthHours, monthNet, pending }) => (
              <tr key={user.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--hover)]">
                <td className="p-3">
                  <input 
                    type="checkbox" 
                    checked={selectedUsers.includes(user.id)}
                    onChange={(e) => setSelectedUsers(e.target.checked ? [...selectedUsers, user.id] : selectedUsers.filter(id => id !== user.id))}
                    className="rounded border-[var(--line)]"
                  />
                </td>
                <td className="p-3">
                  <div className="font-medium text-[var(--ink)]">{user.name}</div>
                  <div className="text-xs text-[var(--muted)]">{user.email}</div>
                </td>
                <td className="p-3"><Pill color={user.role === "admin" ? CAL_COLORS.salary : "#8a8f98"}>{user.role}</Pill></td>
                <td className="p-3 font-mono">{fmtMoney(user.hourlyRate, user.currency || "\u20b9")}/hr</td>
                <td className="p-3">
                  <div className="flex flex-col gap-1 items-start">
                    <Pill color={user.active ? CAL_COLORS.work : CAL_COLORS.fine}>{user.active ? "Active" : "Inactive"}</Pill>
                    {user.resignationStatus === "Requested" && <Pill color={CAL_COLORS.expense}>Resign Req</Pill>}
                  </div>
                </td>
                <td className="p-3 font-mono">{monthHours}h</td>
                <td className="p-3 font-mono">{fmtMoney(monthNet, user.currency || "\u20b9")}</td>
                <td className="p-3 font-mono">{fmtMoney(pending, user.currency || "\u20b9")}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button title="Credit Salary" onClick={() => setPayModal({ user, amount: pending > 0 ? pending : "", date: todayStr(), notes: "Admin Manual Credit" })} className="text-[var(--muted)] hover:text-[#3ecf8e] mr-1.5" ><Wallet size={14} /></button>
                  <button title="Promote" onClick={() => setModal({ mode: "promote", data: user })} className="text-[var(--muted)] hover:text-[#3ecf8e] mr-1.5"><Award size={14} /></button>
                  <button title="Demote" onClick={() => setModal({ mode: "demote", data: user })} className="text-[var(--muted)] hover:text-[var(--danger)] mr-1.5"><TrendingDown size={14} /></button>
                  <button title="Send Notification" onClick={() => setModal({ mode: "notify", data: user })} className="text-[var(--muted)] hover:text-[var(--accent)] mr-1.5"><Send size={14} /></button>
                  <button title="View workspace" onClick={() => onViewAs(user.id)} className="text-[var(--muted)] hover:text-[var(--accent)] mr-1.5"><Eye size={14} /></button>
                  <button title="Edit" onClick={() => setModal({ mode: "edit", data: user })} className="text-[var(--muted)] hover:text-[var(--ink)] mr-1.5"><Edit2 size={14} /></button>
                  <button title="Reset password" onClick={() => setResetModal(user)} className="text-[var(--muted)] hover:text-[var(--ink)] mr-1.5"><Lock size={14} /></button>
                  <button title={user.active ? "Deactivate" : "Activate"} onClick={() => toggleActive(user)} className={`mr-1.5 text-sm ${user.active ? "text-[var(--muted)] hover:text-[var(--danger)]" : "text-[var(--muted)] hover:text-[#3ecf8e]"}`}>{user.active ? "⏸" : "▶"}</button>
                  {user.id !== currentUser.id && <button title="Delete" onClick={() => removeUser(user)} className="text-[var(--muted)] hover:text-[var(--danger)]"><Trash2 size={14} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={!!modal && (modal.mode === "edit" || modal.mode === "new")} onClose={() => setModal(null)} title={modal?.mode === "edit" ? "Edit employee" : "Add employee"} wide>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email"><input className={inputCls} disabled={modal?.mode === "edit"} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          </div>
          {modal?.mode === "new" && (
            <Field label="Temporary password"><input type="password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Role">
              <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Hourly rate"><input type="number" className={inputCls} value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })} /></Field>
            <Field label="Currency"><input className={inputCls} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department"><input className={inputCls} value={form.department || ""} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Designation"><input className={inputCls} value={form.designation || ""} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>
            <Field label="Location"><input className={inputCls} value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          </div>
          <EmploymentHistoryManager history={form.employmentHistory || []} onChange={(newHist) => setForm({ ...form, employmentHistory: newHist })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company"><input className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
            <Field label="Joining date"><input type="date" className={inputCls} value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} /></Field>
          </div>

          {modal?.mode === "edit" && (
            <div className="mt-2 p-3 border border-[var(--danger)]/30 rounded-lg bg-[var(--danger)]/5 flex flex-col gap-3">
              <div className="text-xs uppercase tracking-wider text-[var(--danger)] font-medium">Resignation Management</div>
              {form.resignationStatus === "Requested" && (
                <div className="text-sm bg-[var(--bg)] p-2 rounded border border-[var(--line)]">
                  <span className="font-medium text-[var(--danger)]">Employee requested resignation.</span><br/>
                  Reason: {form.resignationReason}
                </div>
              )}
              {form.resignationStatus === "Approved" && (
                <div className="text-sm bg-[var(--bg)] p-2 rounded border border-[var(--line)]">
                  <span className="font-medium text-[var(--danger)]">Resignation Approved.</span>
                </div>
              )}
              <Field label="Admin Notes for Resignation / Termination (Compulsory for processing)">
                <textarea className={inputCls} rows={2} value={form.adminResignationNotes || ""} onChange={(e) => setForm({ ...form, adminResignationNotes: e.target.value })} />
              </Field>
              {form.resignationStatus !== "Approved" && (
                <Button variant="danger" disabled={!form.adminResignationNotes?.trim()} onClick={() => setForm({ ...form, resignationStatus: "Approved", active: false })}>
                  {form.resignationStatus === "Requested" ? "Approve Resignation & Deactivate" : "Force Resign / Terminate"}
                </Button>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={saveEmployee}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Promote / Demote Modal */}
      <Modal open={!!modal && (modal.mode === "promote" || modal.mode === "demote")} onClose={() => setModal(null)} title={modal?.mode === "promote" ? `Promote — ${modal?.data?.name}` : `Demote — ${modal?.data?.name}`}>
        <div className="flex flex-col gap-3">
          <div className={`p-3 rounded-lg text-sm ${modal?.mode === "promote" ? "bg-[#3ecf8e]/10 text-[#3ecf8e]" : "bg-[var(--danger)]/10 text-[var(--danger)]"}`}>
            {modal?.mode === "promote" ? "A promotion event will be added to the employee's history." : "A demotion event will be added to the employee's history."}
          </div>
          <Field label="Effective Date"><input type="date" className={inputCls} value={promotionForm.date} onChange={(e) => setPromotionForm({ ...promotionForm, date: e.target.value })} /></Field>
          <Field label="New Designation (optional)"><input className={inputCls} value={promotionForm.designation} onChange={(e) => setPromotionForm({ ...promotionForm, designation: e.target.value })} /></Field>
          <Field label="New Department (optional)"><input className={inputCls} value={promotionForm.department} onChange={(e) => setPromotionForm({ ...promotionForm, department: e.target.value })} /></Field>
          <Field label="New Company (optional)"><input className={inputCls} value={promotionForm.company} onChange={(e) => setPromotionForm({ ...promotionForm, company: e.target.value })} /></Field>
          <Field label="Notes"><textarea className={inputCls} rows={2} value={promotionForm.notes} onChange={(e) => setPromotionForm({ ...promotionForm, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant={modal?.mode === "promote" ? "success" : "danger"} onClick={submitPromotion}>
              {modal?.mode === "promote" ? <Award size={15} /> : <TrendingDown size={15} />}
              {modal?.mode === "promote" ? "Confirm Promotion" : "Confirm Demotion"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Send Notification Modal */}
      <Modal open={!!modal && (modal.mode === "notify" || modal.mode === "bulkNotify")} onClose={() => setModal(null)} title={modal?.mode === "bulkNotify" ? `Bulk Notification (${selectedUsers.length} employees)` : `Send Notification — ${modal?.data?.name}`}>
        <div className="flex flex-col gap-3">
          <div className="p-3 rounded-lg text-sm bg-[var(--accent)]/10 text-[var(--accent)]">
            The employee will see this in their notification bell.
          </div>
          <Field label="Title"><input className={inputCls} value={notifForm.title} onChange={(e) => setNotifForm({ ...notifForm, title: e.target.value })} /></Field>
          <Field label="Message"><textarea className={inputCls} rows={3} value={notifForm.message} onChange={(e) => setNotifForm({ ...notifForm, message: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={submitNotification} disabled={!notifForm.title.trim() || !notifForm.message.trim()}><Send size={15} />Send Notification</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!resetModal} onClose={() => setResetModal(null)} title={`Reset password — ${resetModal?.name || ""}`}>
        <div className="flex flex-col gap-3">
          <Field label="New temporary password"><input type="password" className={inputCls} value={resetPw} onChange={(e) => setResetPw(e.target.value)} /></Field>
          <div className="text-xs text-[var(--muted)]">Share this password with the employee directly — there is no email delivery.</div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setResetModal(null)}>Cancel</Button>
            <Button onClick={doReset}>Reset password</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={payModal?.mode === "bulk" ? `Bulk Credit Salary (${selectedUsers.length} employees)` : `Credit Salary — ${payModal?.user?.name || ""}`}>
        {payModal && (
          <div className="flex flex-col gap-3">
            <Field label="Amount"><input type="number" className={inputCls} value={payModal.amount} onChange={(e) => setPayModal({ ...payModal, amount: e.target.value })} /></Field>
            <Field label="Date"><input type="date" className={inputCls} value={payModal.date} onChange={(e) => setPayModal({ ...payModal, date: e.target.value })} /></Field>
            <Field label="Notes"><input className={inputCls} value={payModal.notes} onChange={(e) => setPayModal({ ...payModal, notes: e.target.value })} /></Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setPayModal(null)}>Cancel</Button>
              <Button variant="success" onClick={submitPayment}><Wallet size={15} />Credit Salary</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------------------------- Admin Notifications ---------------------------------- */

function AdminNotificationsView({ users, onSendNotification }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const all = [];
      for (const u of users) {
        if (u.role === "admin") continue;
        try {
          const res = await window.storage.get(dataKey(u.id, "notifications"), true);
          if (res && res.value) {
            const list = JSON.parse(res.value);
            list.forEach(n => all.push({ ...n, user: u }));
          }
        } catch(e) {}
      }
      if (active) {
        setData(all.sort((a, b) => (a.date < b.date ? 1 : -1)));
        setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [users]);

  if (loading) return <EmptyState label="Loading notifications..." />;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[var(--line)] bg-[var(--hover)]">
        <h2 className="text-lg font-semibold text-[var(--ink)] flex items-center gap-2"><Bell size={18} className="text-[var(--accent)]" />Admin — Notification Center</h2>
        <span className="text-xs text-[var(--muted)] font-mono">{data.length} total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)]">
              <th className="p-3">Employee</th>
              <th className="p-3">Date</th>
              <th className="p-3">Title</th>
              <th className="p-3">Message</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-[var(--muted)]">No notifications sent yet.</td></tr>
            ) : data.map((n, i) => (
              <tr key={i} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--hover)]">
                <td className="p-3">
                  <div className="font-medium text-[var(--ink)]">{n.user.name}</div>
                  <div className="text-[10px] text-[var(--muted)] font-mono">{n.user.id.slice(0,6)}</div>
                </td>
                <td className="p-3 font-mono text-xs">{n.date}</td>
                <td className="p-3 font-medium">{n.title}</td>
                <td className="p-3 text-[var(--muted)] text-xs truncate max-w-[200px]" title={n.message}>{n.message}</td>
                <td className="p-3">
                  <Pill color={n.read ? CAL_COLORS.work : CAL_COLORS.expense}>{n.read ? "Read" : "Unread"}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------------------------------- Employee Notifications ---------------------------------- */

function EmployeeNotificationsView({ notifications, onMarkRead }) {
  const [reading, setReading] = useState(null);
  
  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[var(--line)] bg-[var(--hover)]">
        <h2 className="text-lg font-semibold text-[var(--ink)] flex items-center gap-2"><Bell size={18} className="text-[var(--accent)]" />My Notifications</h2>
        <span className="text-xs text-[var(--muted)] font-mono">{notifications.length} total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)]">
              <th className="p-3 w-10"></th>
              <th className="p-3">Date</th>
              <th className="p-3">Title</th>
              <th className="p-3">Message</th>
            </tr>
          </thead>
          <tbody>
            {notifications.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-[var(--muted)]">No notifications.</td></tr>
            ) : [...notifications].reverse().map((n) => (
              <tr key={n.id} onClick={() => { if (!n.read) onMarkRead(n.id); setReading(n); }} className={`border-b border-[var(--line)] last:border-0 hover:bg-[var(--hover)] cursor-pointer ${!n.read ? 'bg-[var(--accent)]/5' : ''}`}>
                <td className="p-3 text-center">
                  {!n.read && <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)]"></span>}
                </td>
                <td className="p-3 font-mono text-xs text-[var(--muted)]">{n.date}</td>
                <td className={`p-3 ${!n.read ? 'font-semibold text-[var(--ink)]' : 'font-medium text-[var(--muted)]'}`}>{n.title}</td>
                <td className="p-3 text-[var(--muted)] text-xs truncate max-w-[250px]">{n.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!reading} onClose={() => setReading(null)} title="Notification">
        {reading && (
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-[var(--ink)] text-lg">{reading.title}</h3>
            <p className="text-sm text-[var(--ink)] whitespace-pre-wrap">{reading.message}</p>
            <div className="text-xs text-[var(--muted)] font-mono">{reading.date} &middot; From Admin</div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setReading(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

/* ---------------------------------- Dashboard ---------------------------------- */

function Dashboard({ reports, leaves, fines, expenses, payments, settings, onNav }) {
  const cur = settings.currency;
  const t = todayStr();
  const todayReports = reports.filter((r) => r.date === t);
  const todayHours = round2(todayReports.reduce((s, r) => s + Number(r.hours || 0), 0));
  const todaySalary = round2(todayReports.reduce((s, r) => s + Number(r.salary || 0), 0));

  const weekSalary = netSalaryFor(reports, fines, expenses, daysAgoStr(6), t).net;
  const monthSalary = netSalaryFor(reports, fines, expenses, t.slice(0, 8) + "01", t).net;
  const last45Salary = netSalaryFor(reports, fines, expenses, daysAgoStr(45), t).net;

  const allTimeRaw = netSalaryFor(reports, fines, expenses, "0000-01-01", t);
  const allTime = allTimeRaw.net;
  const totalPaid = round2(payments.reduce((s, p) => s + Number(p.amount || 0), 0));
  const pendingSalary = round2(allTime - totalPaid);

  const leaveCount = leaves.filter((l) => l.date.slice(0, 7) === t.slice(0, 7)).length;
  const fineThisMonth = round2(fines.filter((f) => f.date.slice(0, 7) === t.slice(0, 7)).reduce((s, r) => s + Number(r.amount || 0), 0));
  const expenseThisMonth = round2(expenses.filter((e) => e.date.slice(0, 7) === t.slice(0, 7)).reduce((s, r) => s + Number(r.amount || 0), 0));

  const nextPayDate = useMemo(() => {
    const now = new Date();
    let d = new Date(now.getFullYear(), now.getMonth(), settings.payDay);
    if (d < now) d = new Date(now.getFullYear(), now.getMonth() + 1, settings.payDay);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, [settings.payDay]);

  const recent = useMemo(() => {
    const items = [
      ...reports.map((r) => ({ date: r.date, label: `Logged ${r.hours}h on ${r.project || r.task || "work"}`, type: "work" })),
      ...payments.map((p) => ({ date: p.date, label: `Received ${fmtMoney(p.amount, cur)} salary payment`, type: "salary" })),
      ...leaves.map((l) => ({ date: l.date, label: `${l.type}`, type: "leave" })),
      ...fines.map((f) => ({ date: f.date, label: `Fine of ${fmtMoney(f.amount, cur)} â€” ${f.reason || "no reason"}`, type: "fine" })),
      ...expenses.map((e) => ({ date: e.date, label: `${e.category} expense ${fmtMoney(e.amount, cur)}`, type: "expense" })),
    ];
    return items.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  }, [reports, payments, leaves, fines, expenses, cur]);

  const joinDate = settings.joiningDate ? new Date(settings.joiningDate) : null;
  const isAnniversary = joinDate && joinDate.getMonth() === new Date().getMonth() && joinDate.getDate() === new Date().getDate() && joinDate.getFullYear() !== new Date().getFullYear();
  const years = joinDate ? new Date().getFullYear() - joinDate.getFullYear() : 0;

  return (
    <div className="flex flex-col gap-5">
      {isAnniversary && (
        <div className="bg-[var(--accent)]/15 border border-[var(--accent)]/30 rounded-xl p-4 flex items-center justify-between no-print">
          <div>
            <div className="font-semibold text-[var(--accent)] text-lg">ðŸŽ‰ Happy Work Anniversary!</div>
            <div className="text-sm text-[var(--ink)] mt-1">Thank you for being a part of {settings.company || "the team"} for {years} year{years > 1 ? "s" : ""}!</div>
          </div>
        </div>
      )}
      <div>
        <h1 className="text-xl font-semibold text-[var(--ink)]">Welcome back, {settings.employeeName.split(" ")[0]}</h1>
        <p className="text-sm text-[var(--muted)]">Here's where things stand today, {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Today's hours" value={`${todayHours}h`} icon={Clock} tint={CAL_COLORS.work} />
        <StatCard label="Today's salary" value={fmtMoney(todaySalary, cur)} icon={IndianRupee} tint={CAL_COLORS.salary} />
        <StatCard label="This week" value={fmtMoney(weekSalary, cur)} icon={TrendingUp} tint={CAL_COLORS.salary} />
        <StatCard label="This month" value={fmtMoney(monthSalary, cur)} icon={Wallet} tint={CAL_COLORS.work} />
        <StatCard label="Last 45 days" value={fmtMoney(last45Salary, cur)} icon={CalendarDays} tint={CAL_COLORS.salary} sub="Rolling window" />
        <StatCard label="Pending salary" value={fmtMoney(pendingSalary, cur)} icon={CircleDollarSign} tint={CAL_COLORS.leave} sub={`Next pay ~${nextPayDate}`} />
        <StatCard label="Leave this month" value={leaveCount} icon={CalendarDays} tint={CAL_COLORS.leave} />
        <StatCard label="Fine / expense (mo)" value={fmtMoney(round2(fineThisMonth + expenseThisMonth), cur)} icon={AlertTriangle} tint={CAL_COLORS.fine} />
      </div>

      <Card className="p-4 bg-[var(--accent)]/5 border-dashed border-[var(--accent)]/30">
        <div className="flex items-center gap-2 mb-2 text-[var(--accent)] font-medium text-sm">
          <CircleDollarSign size={16} /> Salary Balance Breakdown
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm font-mono text-[var(--ink)]">
          <span className="bg-[var(--bg)] px-2 py-1 rounded border border-[var(--line)]" title="Total Gross Salary">
            + {fmtMoney(allTimeRaw.gross, cur)} (Gross)
          </span>
          <span className="text-[var(--muted)]">-</span>
          <span className="bg-[var(--bg)] px-2 py-1 rounded border border-[var(--line)]" title="Total Expenses Logged">
            - {fmtMoney(allTimeRaw.totalExpense, cur)} (Expenses)
          </span>
          <span className="text-[var(--muted)]">-</span>
          <span className="bg-[var(--bg)] px-2 py-1 rounded border border-[var(--line)]" title="Total Fines">
            - {fmtMoney(allTimeRaw.totalFine, cur)} (Fines)
          </span>
          <span className="text-[var(--muted)]">-</span>
          <span className="bg-[var(--bg)] px-2 py-1 rounded border border-[var(--line)]" title="Payments Received">
            - {fmtMoney(totalPaid, cur)} (Paid)
          </span>
          <span className="text-[var(--muted)]">=</span>
          <span className="bg-[var(--accent)] text-white px-2 py-1 rounded font-semibold shadow-sm">
            {fmtMoney(pendingSalary, cur)} (Pending)
          </span>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--ink)]">Recent activity</span>
          </div>
          {recent.length === 0 ? <EmptyState label="Nothing logged yet â€” start your timer or add a work entry." /> : (
            <div className="flex flex-col gap-2.5">
              {recent.map((a, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CAL_COLORS[a.type] }} />
                  <span className="text-[var(--ink)] flex-1 truncate">{a.label}</span>
                  <span className="text-xs font-mono text-[var(--muted)] shrink-0">{a.date.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-4 flex flex-col gap-2">
          <span className="text-sm font-medium text-[var(--ink)] mb-1">Quick actions</span>
          <Button variant="outline" onClick={() => onNav("reports")} className="justify-start"><FileText size={15} />Log work entry</Button>
          <Button variant="outline" onClick={() => onNav("timer")} className="justify-start"><Clock size={15} />Start timer</Button>
          <Button variant="outline" onClick={() => onNav("leaves")} className="justify-start"><CalendarDays size={15} />Apply for leave</Button>
          <Button variant="outline" onClick={() => onNav("payments")} className="justify-start"><Wallet size={15} />Record payment</Button>
          <Button variant="outline" onClick={() => onNav("reportsPage")} className="justify-start"><Download size={15} />Download report</Button>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------- App shell ---------------------------------- */

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "timer", label: "Timer", icon: Clock },
  { key: "reports", label: "Work reports", icon: FileText },
  { key: "leaves", label: "Leave", icon: CalendarDays },
  { key: "fines", label: "Fine", icon: AlertTriangle },
  { key: "expenses", label: "Expenses", icon: Receipt },
  { key: "payments", label: "Payments", icon: Wallet },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "reportsPage", label: "Reports", icon: FileSpreadsheet },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "settings", label: "Profile & settings", icon: SettingsIcon },
];

const ADMIN_NAV = [
  { key: "admin", label: "Manage Employees", icon: ShieldCheck },
  { key: "admin_notifications", label: "Sent Notifications", icon: Bell },
];

export default function App() {
  const [users, setUsers, usersLoaded] = useStorage(K.users, [], true);
  const [persistedSession, setPersistedSession, sessionLoaded] = useStorage(K.session, null, false);
  const [ephemeralSession, setEphemeralSession] = useState(null);
  const [viewingUserId, setViewingUserId] = useState(null);
  const [view, setView] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsMap, setNotificationsMap] = useState({});

  useEffect(() => {
    if (usersLoaded && users.length === 0) {
      hashPassword("admin").then((hash) => {
        setUsers([{
          id: uid(), name: "System Admin", email: "admin@admin.com", passwordHash: hash,
          role: "admin", hourlyRate: 0, currency: "\u20b9", company: "Company", department: "Management", phone: "",
          joiningDate: todayStr(), active: true, employmentHistory: []
        }]);
      });
    }
  }, [usersLoaded, users.length, setUsers]);

  const session = ephemeralSession || persistedSession;
  const currentUser = session ? users.find((u) => u.id === session.userId) : null;
  const effectiveUser = viewingUserId ? users.find((u) => u.id === viewingUserId) : currentUser;
  const effectiveUserId = effectiveUser?.id;

  const onLogin = (user, remember) => {
    if (remember) { setPersistedSession({ userId: user.id }); }
    else { setEphemeralSession({ userId: user.id }); }
  };
  const onLogout = () => {
    setPersistedSession(null);
    setEphemeralSession(null);
    setViewingUserId(null);
    setView("dashboard");
  };
  const onUpdateUser = (patch) => setUsers((prev) => prev.map((u) => (u.id === effectiveUserId ? { ...u, ...patch } : u)));
  const onSendNotification = async (userId, notif) => {
    const key = dataKey(userId, "notifications");
    let current = [];
    try { const r = await window.storage.get(key, true); if (r && r.value) current = JSON.parse(r.value); } catch(e) {}
    current.push(notif);
    await window.storage.set(key, JSON.stringify(current), true);
    setNotificationsMap((prev) => ({ ...prev, [userId]: current }));
  };
  const currentNotifications = useMemo(() => notificationsMap[effectiveUserId] || [], [notificationsMap, effectiveUserId]);
  useEffect(() => {
    if (!effectiveUserId) return;
    const load = async () => {
      try { const r = await window.storage.get(dataKey(effectiveUserId, "notifications"), true); if (r && r.value) setNotificationsMap((prev) => ({ ...prev, [effectiveUserId]: JSON.parse(r.value) })); } catch(e) {}
    };
    load();
  }, [effectiveUserId]);
  const markNotifRead = async (nid) => {
    const updated = currentNotifications.map((n) => n.id === nid ? { ...n, read: true } : n);
    await window.storage.set(dataKey(effectiveUserId, "notifications"), JSON.stringify(updated), true);
    setNotificationsMap((prev) => ({ ...prev, [effectiveUserId]: updated }));
  };
  const markAllRead = async () => {
    const updated = currentNotifications.map((n) => ({ ...n, read: true }));
    await window.storage.set(dataKey(effectiveUserId, "notifications"), JSON.stringify(updated), true);
    setNotificationsMap((prev) => ({ ...prev, [effectiveUserId]: updated }));
  };

  const [reports, setReports, reportsLoaded] = useStorage(effectiveUserId ? dataKey(effectiveUserId, "reports") : "wfp:guest:reports", [], true);
  const [leaves, setLeaves, leavesLoaded] = useStorage(effectiveUserId ? dataKey(effectiveUserId, "leaves") : "wfp:guest:leaves", [], true);
  const [fines, setFines, finesLoaded] = useStorage(effectiveUserId ? dataKey(effectiveUserId, "fines") : "wfp:guest:fines", [], true);
  const [expenses, setExpenses, expensesLoaded] = useStorage(effectiveUserId ? dataKey(effectiveUserId, "expenses") : "wfp:guest:expenses", [], true);
  const [payments, setPayments, paymentsLoaded] = useStorage(effectiveUserId ? dataKey(effectiveUserId, "payments") : "wfp:guest:payments", [], true);
  const [prefs, setPrefs, prefsLoaded] = useStorage(effectiveUserId ? dataKey(effectiveUserId, "prefs") : "wfp:guest:prefs", { currency: "\u20b9", theme: "dark", payDay: 1 }, true);
  const [timer, setTimer, timerLoaded] = useStorage(effectiveUserId ? dataKey(effectiveUserId, "timer") : "wfp:guest:timer", { running: false, accumulated: 0, startedAt: null, project: "", task: "" }, true);

  const rawTheme = prefs.theme || "dark";
  const systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = rawTheme === "system" ? (systemPrefersDark ? "dark" : "light") : rawTheme;

  const settings = useMemo(() => ({
    employeeName: effectiveUser?.name || "",
    company: effectiveUser?.company || "",
    hourlyRate: effectiveUser?.hourlyRate || 0,
    currency: prefs.currency || "\u20b9",
    theme,
    payDay: prefs.payDay || 1,
    joiningDate: effectiveUser?.joiningDate || "",
  }), [effectiveUser, prefs, theme]);

  const finishTimer = (hours) => {
    const salary = computeSalary(hours, settings.hourlyRate);
    setReports((prev) => [
      ...prev,
      {
        id: uid(), date: todayStr(), project: timer.project || "Untitled project", task: timer.task || "Timed session",
        description: "", startTime: "", endTime: "", breakMins: 0, hours, salary,
        priority: "Medium", status: "Completed", tags: "", notes: "Logged via live timer",
      },
    ]);
    setView("reports");
  };

  const vars = theme === "dark"
    ? { "--bg": "#0d0e12", "--panel": "#15171c", "--ink": "#eef0f3", "--muted": "#8a8f98", "--line": "#23262e", "--hover": "#1c1f26", "--accent": "#4d7cfe", "--danger": "#e5484d" }
    : { "--bg": "#f6f7f9", "--panel": "#ffffff", "--ink": "#14161a", "--muted": "#6b7280", "--line": "#e6e8ec", "--hover": "#f0f2f5", "--accent": "#3454d1", "--danger": "#e5484d" };


  if (!usersLoaded || !sessionLoaded) {
    return <div style={vars} className="min-h-[400px] flex items-center justify-center bg-[var(--bg)] text-[var(--muted)] text-sm">Loading WorkFlow Proâ€¦</div>;
  }

  if (!currentUser) {
    return (
      <div style={vars}>
        <AuthScreen users={users} setUsers={setUsers} onLogin={onLogin} />
      </div>
    );
  }

  const dataLoaded = reportsLoaded && leavesLoaded && finesLoaded && expensesLoaded && paymentsLoaded && prefsLoaded && timerLoaded;
  const isAdmin = currentUser.role === "admin";
  const nav = viewingUserId ? NAV : (isAdmin ? [...NAV, ...ADMIN_NAV] : NAV);

  return (
    <div style={vars} className="min-h-screen w-full bg-[var(--bg)] text-[var(--ink)] flex flex-col md:flex-row font-sans">
      <style>{`
        @media print {
          .no-print, aside, .app-topbar { display: none !important; }
          .print-area { display: block !important; }
        }
      `}</style>
      
      <div className="md:hidden flex items-center justify-between p-3 border-b border-[var(--line)] bg-[var(--panel)] no-print">
        <div className="font-semibold text-[var(--ink)] tracking-tight">WorkFlow Pro</div>
        <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-[var(--hover)] text-[var(--ink)]">
          <Menu size={20} />
        </button>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} transition-transform duration-300 md:relative md:translate-x-0 w-64 shrink-0 border-r border-[var(--line)] bg-[var(--panel)] flex flex-col p-3 gap-1 no-print`}>
        <div className="flex items-start justify-between px-2 py-3 mb-2">
          <div>
            <div className="font-semibold text-[var(--ink)] tracking-tight">WorkFlow Pro</div>
            <div className="text-[11px] text-[var(--muted)]">Salary & payroll tracker</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1.5 rounded-lg hover:bg-[var(--hover)] text-[var(--ink)]"><X size={18} /></button>
        </div>
        {viewingUserId && (
          <button onClick={() => { setViewingUserId(null); setView("admin"); }} className="flex items-center gap-2 px-2.5 py-2 mb-1 rounded-lg text-xs bg-[var(--accent)]/15 text-[var(--accent)] font-medium">
            <ArrowLeft size={14} />Back to admin
          </button>
        )}
        {nav.filter((n) => n.key !== "admin").map((n) => (
          <button
            key={n.key}
            onClick={() => { setView(n.key); setSidebarOpen(false); }}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${view === n.key ? "bg-[var(--accent)]/15 text-[var(--accent)] font-medium" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"}`}
          >
            <n.icon size={16} />{n.label}
          </button>
        ))}
        {isAdmin && !viewingUserId && (
          <button
            onClick={() => { setView("admin"); setSidebarOpen(false); }}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors mt-1 border-t border-[var(--line)] pt-2.5 ${view === "admin" ? "bg-[var(--accent)]/15 text-[var(--accent)] font-medium" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"}`}
          >
            <ShieldCheck size={16} />Admin
          </button>
        )}
        <div className="mt-auto px-2 py-2 flex items-center justify-between text-xs text-[var(--muted)]">
          <span className="truncate">{effectiveUser.currency || settings.currency}{effectiveUser.hourlyRate}/hr</span>
          <button onClick={() => {
            const next = rawTheme === "dark" ? "light" : rawTheme === "light" ? "system" : "dark";
            setPrefs({ ...prefs, theme: next });
          }} className="p-1.5 rounded-lg hover:bg-[var(--hover)]" title="Cycle theme">
            {rawTheme === "dark" ? <Sun size={14} /> : rawTheme === "light" ? <Monitor size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {viewingUserId && (
          <div className="bg-[var(--accent)]/15 text-[var(--accent)] text-xs px-5 py-2 flex items-center justify-between no-print">
            <span>Admin mode â€” viewing {effectiveUser.name}'s workspace. Changes here affect their account.</span>
            <button onClick={() => { setViewingUserId(null); setView("admin"); }} className="underline">Exit</button>
          </div>
        )}
        <div className="app-topbar flex items-center gap-3 px-5 py-3 border-b border-[var(--line)] no-print">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
              placeholder="Search work reportsâ€¦"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!isAdmin && <NotificationBell notifications={currentNotifications} onMarkRead={markNotifRead} onMarkAll={markAllRead} />}
            <span className="text-xs text-[var(--muted)] font-mono hidden sm:inline">{currentUser.name} &middot; {currentUser.role}</span>
          </div>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {!dataLoaded && view !== "admin" ? (
            <div className="text-sm text-[var(--muted)]">Loading workspaceâ€¦</div>
          ) : (
            <>
              {view === "dashboard" && <Dashboard reports={reports} leaves={leaves} fines={fines} expenses={expenses} payments={payments} settings={settings} onNav={setView} />}
              {view === "timer" && (
                <div className="max-w-md mx-auto">
                  <TimerCard timer={timer} setTimer={setTimer} onFinish={finishTimer} rate={settings.hourlyRate} />
                </div>
              )}
              {view === "reports" && <WorkReportsView reports={reports} setReports={setReports} rate={settings.hourlyRate} currency={settings.currency} search={search} />}
              {view === "analytics" && <AnalyticsView reports={reports} expenses={expenses} fines={fines} payments={payments} currency={settings.currency} settings={settings} />}
              {view === "leaves" && (
                <RecordManager title="Leaves" icon={CalendarDays} color={CAL_COLORS.leave} currency={settings.currency}
                  records={leaves} setRecords={setLeaves} search={search}
                  fields={[
                    { key: "date", label: "Date", type: "date" },
                    { key: "type", label: "Type", type: "select", options: LEAVE_TYPES },
                    { key: "reason", label: "Reason", type: "text" },
                    { key: "notes", label: "Notes", type: "textarea" },
                  ]}
                />
              )}
              {view === "fines" && (
                <RecordManager title="Fines" icon={AlertTriangle} color={CAL_COLORS.fine} currency={settings.currency} amountKey="amount"
                  records={fines} setRecords={setFines} search={search}
                  fields={[
                    { key: "date", label: "Date", type: "date" },
                    { key: "reason", label: "Reason", type: "text" },
                    { key: "amount", label: "Amount", type: "number" },
                    { key: "notes", label: "Notes", type: "textarea" },
                  ]}
                />
              )}
              {view === "expenses" && (
                <RecordManager title="Expenses" icon={Receipt} color={CAL_COLORS.expense} currency={settings.currency} amountKey="amount"
                  records={expenses} setRecords={setExpenses} search={search}
                  fields={[
                    { key: "date", label: "Date", type: "date" },
                    { key: "category", label: "Category", type: "select", options: EXPENSE_CATS },
                    { key: "amount", label: "Amount", type: "number" },
                    { key: "notes", label: "Notes", type: "textarea" },
                  ]}
                />
              )}
              {view === "payments" && (
                <RecordManager title="Payments" icon={Wallet} color={CAL_COLORS.salary} currency={settings.currency} amountKey="amount"
                  records={payments} setRecords={setPayments} search={search}
                  fields={[
                    { key: "date", label: "Date", type: "date" },
                    { key: "amount", label: "Amount", type: "number" },
                    { key: "transactionId", label: "Transaction ID", type: "text" },
                    { key: "mode", label: "Mode", type: "select", options: PAY_MODES },
                    { key: "notes", label: "Notes", type: "textarea" },
                  ]}
                />
              )}
              {view === "calendar" && <CalendarView reports={reports} leaves={leaves} fines={fines} payments={payments} expenses={expenses} />}

              {view === "reportsPage" && <ReportsView reports={reports} leaves={leaves} fines={fines} expenses={expenses} payments={payments} currency={settings.currency} settings={settings} />}
              {view === "notifications" && <EmployeeNotificationsView notifications={currentNotifications} onMarkRead={markNotifRead} />}
              {view === "settings" && (
                <SettingsView
                  user={effectiveUser}
                  onUpdateUser={onUpdateUser}
                  prefs={prefs}
                  setPrefs={setPrefs}
                  canEditPayroll={isAdmin}
                  isOwnAccount={!viewingUserId}
                  onLogout={onLogout}
                />
              )}
              {view === "admin" && isAdmin && !viewingUserId && (
                <AdminView users={users} setUsers={setUsers} currentUser={currentUser} search={search} onViewAs={(id) => { setViewingUserId(id); setView("dashboard"); }} onSendNotification={onSendNotification} />
              )}
              {view === "admin_notifications" && isAdmin && !viewingUserId && (
                <AdminNotificationsView users={users} onSendNotification={onSendNotification} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

