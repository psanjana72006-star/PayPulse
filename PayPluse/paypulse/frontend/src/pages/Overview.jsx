import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../services/api"; import { inr } from "../utils/format";
export default function Overview() {
  const [s, setS] = useState(null); const [err, setErr] = useState("");
  useEffect(() => { api.stats().then(setS).catch(() => setErr("Cannot reach the backend. Start it on port 8000.")); }, []);
  if (err) return <p className="rounded-xl bg-red-50 p-4 text-red-600">{err}</p>;
  if (!s) return <p className="text-slate-500">Loading overview…</p>;
  const kpis = [["Total receivables", inr(s.total_receivables)], ["Overdue payments", inr(s.overdue)],
    ["Collected", inr(s.collected)], ["Active invoices", s.active]];
  const data = [{ m: "Jun", v: 180000 }, { m: "Jul", v: 210000 }, { m: "Aug", v: 195000 }, { m: "Sep", v: 260000 }, { m: "Oct", v: s.collected }];
  return (<div className="space-y-6"><h1 className="text-2xl font-extrabold">Overview</h1>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(([l, v]) =>
      <div key={l} className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{l}</p><p className="mt-1 text-2xl font-extrabold">{v}</p></div>)}</div>
    <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="mb-3 font-bold">Payments collected</p>
      <div className="h-64"><ResponsiveContainer><BarChart data={data}><XAxis dataKey="m" /><YAxis tickFormatter={v => v / 1000 + "k"} /><Tooltip formatter={inr} /><Bar dataKey="v" fill="#10B981" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></div></div>);
}
