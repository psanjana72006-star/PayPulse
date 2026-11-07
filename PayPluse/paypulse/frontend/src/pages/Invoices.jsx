import { useEffect, useState, useRef } from "react";
import { Upload, Trash2, Plus, Check } from "lucide-react";
import { api } from "../services/api"; import { inr, statusStyle } from "../utils/format";
const STATUSES = ["Paid", "Pending", "Overdue", "Financing Requested"];
const blank = { number: "", customer: "", invoice_date: "", due_date: "", amount: "", status: "Pending" };
export default function Invoices() {
  const [rows, setRows] = useState(null); const [q, setQ] = useState(""); const [f, setF] = useState("All");
  const [draft, setDraft] = useState(null); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const input = useRef();
  const toast = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };
  const load = () => api.invoices().then(setRows).catch(() => setMsg("Cannot reach the backend. Start it on port 8000."));
  useEffect(() => { load(); }, []);
  const upload = async (file) => { if (!file) return; setBusy(true);
    try { const d = await api.extract(file); setDraft({ ...blank, ...d }); } catch { toast("Extraction failed. Try again."); } setBusy(false); };
  const save = async () => { try { await api.create({ ...draft, amount: Number(draft.amount) }); setDraft(null); toast("Invoice saved"); load(); }
    catch { toast("Could not save. Check all fields."); } };
  const shown = (rows || []).filter(r => (f === "All" || r.status === f) && (r.customer + r.number).toLowerCase().includes(q.toLowerCase()));
  const fields = [["customer", "Customer"], ["number", "Invoice number"], ["amount", "Amount (₹)"], ["invoice_date", "Invoice date"], ["due_date", "Due date"]];
  return (<div className="space-y-5"><div className="flex items-center justify-between"><h1 className="text-2xl font-extrabold">Invoices</h1>
    <button onClick={() => setDraft({ ...blank })} className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald"><Plus size={16} />Add invoice</button></div>
    {msg && <p role="status" className="rounded-xl bg-emerald/10 px-4 py-2 text-sm text-emerald">{msg}</p>}
    <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files[0]); }} onClick={() => input.current.click()}
      className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center transition hover:border-emerald">
      <Upload className="text-emerald" /><p className="mt-2 font-semibold">{busy ? "Reading invoice…" : "Drop an invoice PDF or image here"}</p>
      <p className="text-sm text-slate-500">Details come from simulated OCR. Review them before saving.</p>
      <input ref={input} type="file" accept="image/*,.pdf" hidden onChange={e => upload(e.target.files[0])} /></div>
    {draft && <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="mb-3 font-bold">Review invoice details</p>
      <div className="grid gap-3 sm:grid-cols-3">{fields.map(([k, l]) =>
        <label key={k} className="text-sm text-slate-600">{l}<input value={draft[k]} type={k.includes("date") ? "date" : k === "amount" ? "number" : "text"}
          onChange={e => setDraft({ ...draft, [k]: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-navy" /></label>)}</div>
      <div className="mt-4 flex gap-2"><button onClick={save} className="flex items-center gap-2 rounded-xl bg-emerald px-4 py-2 text-sm font-semibold text-white"><Check size={16} />Confirm and save</button>
        <button onClick={() => setDraft(null)} className="rounded-xl px-4 py-2 text-sm text-slate-500">Cancel</button></div></div>}
    <div className="flex flex-wrap gap-3"><input placeholder="Search customer or number" value={q} onChange={e => setQ(e.target.value)} className="w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
      <select value={f} onChange={e => setF(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">{["All", ...STATUSES].map(s => <option key={s}>{s}</option>)}</select></div>
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm"><table className="w-full text-left text-sm">
      <thead className="text-slate-500"><tr>{["Invoice", "Customer", "Invoice date", "Due date", "Amount", "Status", ""].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
      <tbody>{!rows ? <tr><td className="p-6 text-slate-500" colSpan={7}>Loading invoices…</td></tr> : shown.length === 0 ?
        <tr><td className="p-6 text-slate-500" colSpan={7}>No invoices match. Upload one or clear the filters.</td></tr> :
        shown.map(r => <tr key={r.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{r.number}</td><td className="px-4">{r.customer}</td>
          <td className="px-4">{r.invoice_date}</td><td className="px-4">{r.due_date}</td><td className="px-4 font-semibold">{inr(r.amount)}</td>
          <td className="px-4"><select value={r.status} onChange={async e => { await api.update(r.id, { ...r, status: e.target.value }); toast("Status updated"); load(); }}
            className={"rounded-full px-2 py-1 text-xs font-semibold " + statusStyle[r.status]}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></td>
          <td className="px-4"><button aria-label="Delete invoice" onClick={async () => { await api.remove(r.id); toast("Invoice deleted"); load(); }} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button></td></tr>)}</tbody></table></div></div>);
}
