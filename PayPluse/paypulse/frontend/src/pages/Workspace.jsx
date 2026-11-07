import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../services/api";
import { inr, statusStyle } from "../utils/format";

const STATUSES = ["Paid", "Pending", "Overdue", "Financing Requested"];
const card = "rounded-2xl bg-white p-5 shadow-sm";
const button = "rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald disabled:cursor-not-allowed disabled:opacity-50";
const input = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-navy";

function useInvoices() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const reload = () => api.invoices().then(data => { setRows(data); setError(""); })
    .catch(() => setError("Could not load invoices. Check that the PayPulse API is running on port 8000."));
  useEffect(() => { reload(); }, []);
  return { rows, error, reload, setError };
}

function Message({ children, error = false }) {
  if (!children) return null;
  return <p role="status" className={"rounded-xl px-4 py-3 text-sm " + (error ? "bg-red-50 text-red-700" : "bg-emerald/10 text-emerald")}>{children}</p>;
}

function InvoiceTable({ rows, onStatusChange, action }) {
  if (!rows.length) return <p className="p-5 text-sm text-slate-500">No invoices to show yet. Add one from the Invoices page.</p>;
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm">
    <thead className="text-slate-500"><tr>{["Invoice", "Customer", "Due date", "Amount", "Status", action ? "Action" : ""].filter(Boolean).map(h =>
      <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.id} className="border-t border-slate-100">
      <td className="px-4 py-3 font-semibold">{row.number}</td><td className="px-4">{row.customer}</td>
      <td className="px-4">{row.due_date}</td><td className="px-4 font-semibold">{inr(row.amount)}</td>
      <td className="px-4"><select aria-label={"Status for " + row.number} value={row.status}
        onChange={e => onStatusChange(row, e.target.value)} className={"rounded-full px-2 py-1 text-xs font-semibold " + statusStyle[row.status]}>
        {STATUSES.map(status => <option key={status}>{status}</option>)}</select></td>
      {action && <td className="px-4">{action(row)}</td>}
    </tr>)}</tbody></table></div>;
}

function useStatusUpdate(reload, setError) {
  return async (invoice, status) => {
    try {
      await api.update(invoice.id, { ...invoice, status });
      setError("");
      await reload();
    } catch {
      setError("Could not update the invoice. Please try again.");
    }
  };
}

export function Payments() {
  const { rows, error, reload, setError } = useInvoices();
  const updateStatus = useStatusUpdate(reload, setError);
  const totals = useMemo(() => (rows || []).reduce((result, invoice) => {
    const key = invoice.status === "Paid" ? "paid" : "outstanding";
    result[key] += Number(invoice.amount) || 0;
    return result;
  }, { paid: 0, outstanding: 0 }), [rows]);
  return <div className="space-y-5"><div><h1 className="text-2xl font-extrabold">Payments</h1>
    <p className="mt-1 text-sm text-slate-500">Track money received and update invoice payment status.</p></div>
    <Message error>{error}</Message>
    <div className="grid gap-4 sm:grid-cols-2"><div className={card}><p className="text-sm text-slate-500">Payments received</p>
      <p className="mt-1 text-2xl font-extrabold">{rows ? inr(totals.paid) : "Loading…"}</p></div>
      <div className={card}><p className="text-sm text-slate-500">Outstanding invoices</p>
        <p className="mt-1 text-2xl font-extrabold">{rows ? inr(totals.outstanding) : "Loading…"}</p></div></div>
    <div className={card}><h2 className="mb-3 font-bold">Invoice payment activity</h2>
      {rows ? <InvoiceTable rows={rows} onStatusChange={updateStatus} /> : !error && <p className="text-sm text-slate-500">Loading payments…</p>}</div>
  </div>;
}

export function FollowUps() {
  const { rows, error } = useInvoices();
  const [selectedId, setSelectedId] = useState("");
  const [stage, setStage] = useState("1");
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const eligible = (rows || []).filter(invoice => invoice.status !== "Paid");
  const selected = eligible.find(invoice => String(invoice.id) === selectedId) || eligible[0];
  useEffect(() => { if (selected && !selectedId) setSelectedId(String(selected.id)); }, [selected, selectedId]);
  const generate = async () => {
    if (!selected) return;
    setBusy(true); setMessage("");
    try {
      const result = await api.reminder(stage, selected);
      setDraft(result.message);
    } catch {
      setMessage("Could not generate the reminder. Check the API connection and try again.");
    } finally { setBusy(false); }
  };
  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setMessage("Reminder copied to clipboard. Review it before sending.");
    } catch {
      setMessage("Clipboard access is unavailable. Select and copy the reminder text manually.");
    }
  };
  return <div className="space-y-5"><div><h1 className="text-2xl font-extrabold">AI Follow-ups</h1>
    <p className="mt-1 text-sm text-slate-500">Create a reviewable payment reminder for an unpaid invoice.</p></div>
    <Message error>{error}</Message><Message>{message}</Message>
    {rows && <div className={card + " space-y-4"}>
      {!eligible.length ? <p className="text-sm text-slate-500">All invoices are paid. Unpaid invoices will appear here.</p> :
        <><div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-600">Invoice<select value={selected ? String(selected.id) : ""}
            onChange={e => setSelectedId(e.target.value)} className={"mt-1 w-full " + input}>
            {eligible.map(invoice => <option key={invoice.id} value={invoice.id}>{invoice.number} · {invoice.customer} · {inr(invoice.amount)}</option>)}
          </select></label>
          <label className="text-sm font-medium text-slate-600">Reminder stage<select value={stage} onChange={e => setStage(e.target.value)}
            className={"mt-1 w-full " + input}><option value="1">Friendly reminder</option><option value="2">Past due follow-up</option>
            <option value="3">Final reminder draft</option></select></label></div>
          <button type="button" className={button} disabled={busy || !selected} onClick={generate}>{busy ? "Creating draft…" : "Generate reminder"}</button>
          {draft && <div className="space-y-3"><label className="block text-sm font-semibold">Review and edit before sending
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={8} className={"mt-2 w-full resize-y " + input} /></label>
            <button type="button" className={button} onClick={copyDraft}>Copy reminder</button></div>}
          <p className="text-xs text-slate-500">Draft only: PayPulse does not send messages. Please review all details before contacting a customer.</p></>}
    </div>}
  </div>;
}

export function InstantCash() {
  const { rows, error, reload, setError } = useInvoices();
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const eligible = (rows || []).filter(invoice => invoice.status !== "Paid" && invoice.status !== "Financing Requested");
  const request = async invoice => {
    setBusyId(invoice.id); setMessage("");
    try {
      await api.update(invoice.id, { ...invoice, status: "Financing Requested" });
      setMessage("Financing request recorded for " + invoice.number + ". A partner would need to review eligibility and terms.");
      await reload();
    } catch {
      setError("Could not save your financing request. Please try again.");
    } finally { setBusyId(null); }
  };
  const pending = (rows || []).filter(invoice => invoice.status === "Financing Requested");
  return <div className="space-y-5"><div><h1 className="text-2xl font-extrabold">Instant Cash</h1>
    <p className="mt-1 text-sm text-slate-500">Explore invoice financing requests for eligible unpaid invoices.</p></div>
    <Message error>{error}</Message><Message>{message}</Message>
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      Financing is illustrative and subject to partner eligibility, fees, and terms. This prototype does not submit a loan application or guarantee funding.</div>
    {pending.length > 0 && <div className={card}><h2 className="mb-2 font-bold">Requests already recorded</h2>
      <p className="text-sm text-slate-500">{pending.map(invoice => invoice.number + " · " + inr(invoice.amount)).join("  |  ")}</p></div>}
    <div className={card}><h2 className="mb-3 font-bold">Unpaid invoices</h2>
      {rows ? eligible.length ? <div className="space-y-3">{eligible.map(invoice => <div key={invoice.id}
        className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-semibold">{invoice.number} · {invoice.customer}</p><p className="text-sm text-slate-500">Invoice value {inr(invoice.amount)} · Due {invoice.due_date}</p></div>
        <button type="button" className={button} disabled={busyId === invoice.id} onClick={() => request(invoice)}>
          {busyId === invoice.id ? "Saving…" : "Record financing interest"}</button></div>)}</div> :
        <p className="text-sm text-slate-500">No unpaid invoices available to request financing.</p> : !error && <p className="text-sm text-slate-500">Loading invoices…</p>}</div>
  </div>;
}

export function CashFlow() {
  const [days, setDays] = useState(14);
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setBusy(true); setError("");
    api.forecast(days).then(data => { if (active) setForecast(data); })
      .catch(() => { if (active) setError("Could not load the forecast. Check that the PayPulse API is running."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [days]);
  const last = forecast && forecast[forecast.length - 1];
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl font-extrabold">Cash Flow</h1><p className="mt-1 text-sm text-slate-500">Explore a projected balance using the prototype forecast.</p></div>
    <label className="text-sm font-medium text-slate-600">Forecast period<select value={days} onChange={e => setDays(Number(e.target.value))}
      className={"ml-2 " + input}><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></label></div>
    <Message error>{error}</Message>
    {last && <div className={card}><p className="text-sm text-slate-500">Projected balance after {days} days</p>
      <p className="mt-1 text-2xl font-extrabold">{inr(last.balance)}</p></div>}
    <div className={card}><h2 className="mb-4 font-bold">Projected inflows and outflows</h2><div className="h-72">
      {forecast && <ResponsiveContainer width="100%" height="100%"><BarChart data={forecast}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" /><YAxis tickFormatter={value => inr(value)} />
        <Tooltip formatter={value => inr(value)} /><Bar dataKey="inflow" name="Inflow" fill="#10B981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="outflow" name="Outflow" fill="#F59E0B" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>}
      {busy && <p className="text-sm text-slate-500">Loading forecast…</p>}</div></div>
    {forecast && <div className={card + " overflow-x-auto"}><h2 className="mb-3 font-bold">Daily projection</h2><table className="w-full text-left text-sm">
      <thead className="text-slate-500"><tr>{["Day", "Inflow", "Outflow", "Projected balance"].map(title => <th key={title} className="px-3 py-2">{title}</th>)}</tr></thead>
      <tbody>{forecast.map(day => <tr key={day.day} className="border-t border-slate-100">
        <td className="px-3 py-2 font-medium">{day.day}</td><td className="px-3 py-2">{inr(day.inflow)}</td>
        <td className="px-3 py-2">{inr(day.outflow)}</td><td className="px-3 py-2 font-semibold">{inr(day.balance)}</td>
      </tr>)}</tbody></table></div>}
    <p className="text-xs text-slate-500">Illustrative projection from demo data; not financial advice or a guarantee of future balances.</p>
  </div>;
}

export function CreditScore() {
  const { rows, error } = useInvoices();
  const result = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const paid = rows.filter(invoice => invoice.status === "Paid").length;
    const overdue = rows.filter(invoice => invoice.status === "Overdue").length;
    const paymentRate = Math.round(paid / rows.length * 100);
    const score = Math.max(300, Math.min(850, Math.round(500 + paymentRate * 2.5 - overdue / rows.length * 400)));
    return { paid, overdue, total: rows.length, paymentRate, score };
  }, [rows]);
  const band = !result ? "" : result.score >= 750 ? "Strong payment profile" : result.score >= 650 ? "Building payment profile" : "Needs attention";
  return <div className="space-y-5"><div><h1 className="text-2xl font-extrabold">Credit Score</h1>
    <p className="mt-1 text-sm text-slate-500">Understand payment habits visible in your PayPulse invoices.</p></div>
    <Message error>{error}</Message>
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
      This is a simple educational estimate based only on invoices in this prototype. It is not a bureau score, credit decision, or loan eligibility assessment.</div>
    {result && <><div className={card + " text-center"}><p className="text-sm text-slate-500">Illustrative payment profile</p>
      <p className="mt-2 text-5xl font-extrabold">{result.score}</p><p className="mt-2 font-semibold text-emerald">{band}</p>
      <div className="mx-auto mt-5 h-3 max-w-xl overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald"
        style={{ width: ((result.score - 300) / 550 * 100) + "%" }} /></div>
      <div className="mx-auto mt-1 flex max-w-xl justify-between text-xs text-slate-400"><span>300</span><span>850</span></div></div>
      <div className="grid gap-4 sm:grid-cols-3"><div className={card}><p className="text-sm text-slate-500">Invoices paid</p>
        <p className="mt-1 text-2xl font-extrabold">{result.paid} / {result.total}</p></div>
        <div className={card}><p className="text-sm text-slate-500">Overdue invoices</p><p className="mt-1 text-2xl font-extrabold">{result.overdue}</p></div>
        <div className={card}><p className="text-sm text-slate-500">Paid invoice share</p><p className="mt-1 text-2xl font-extrabold">{result.paymentRate}%</p></div></div>
      <div className={card}><h2 className="font-bold">Ways to strengthen your profile</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600"><li>Keep invoice due dates and payment statuses up to date.</li>
          <li>Follow up early on outstanding invoices.</li><li>Record paid invoices so your payment history stays complete.</li></ul></div></>}
    {!rows && !error && <p className="text-sm text-slate-500">Loading invoice history…</p>}
    {rows && !rows.length && <p className={card + " text-sm text-slate-500"}>Add invoices to see a payment profile.</p>}
  </div>;
}

const prompts = ["How much is overdue?", "Which invoice should I follow up on?", "Summarize my invoices"];
function answerPrompt(prompt, rows) {
  const unpaid = rows.filter(invoice => invoice.status !== "Paid");
  const overdue = rows.filter(invoice => invoice.status === "Overdue");
  if (/overdue/i.test(prompt)) return overdue.length
    ? `${overdue.length} invoice${overdue.length === 1 ? "" : "s"} overdue, totaling ${inr(overdue.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0))}: ${overdue.map(invoice => invoice.number + " (" + invoice.customer + ")").join(", ")}.`
    : "There are no invoices currently marked overdue.";
  if (/follow.?up|which invoice/i.test(prompt)) {
    const candidate = [...overdue].sort((a, b) => Number(b.amount) - Number(a.amount))[0] || unpaid[0];
    return candidate ? `Consider following up on ${candidate.number} for ${candidate.customer}, worth ${inr(candidate.amount)} and due ${candidate.due_date}. Review the invoice before sending a reminder.`
      : "All invoices are marked paid, so there are no follow-ups to suggest.";
  }
  const outstanding = unpaid.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const collected = rows.filter(invoice => invoice.status === "Paid").reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  return `You have ${rows.length} invoice${rows.length === 1 ? "" : "s"}: ${inr(outstanding)} outstanding across ${unpaid.length}, and ${inr(collected)} marked paid across ${rows.length - unpaid.length}.`;
}

export function Assistant() {
  const { rows, error } = useInvoices();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const send = prompt => {
    const text = prompt.trim();
    if (!text || !rows) return;
    setMessages(previous => [...previous, { question: text, answer: answerPrompt(text, rows) }]);
    setQuestion("");
  };
  return <div className="space-y-5"><div><h1 className="text-2xl font-extrabold">AI Assistant</h1>
    <p className="mt-1 text-sm text-slate-500">Ask for a summary or follow-up suggestions based on your invoice data.</p></div>
    <Message error>{error}</Message>
    <div className={card}><div className="mb-4 space-y-3" aria-live="polite">
      {!messages.length && <p className="text-sm text-slate-500">Choose a question to get started. Responses use your current invoice list.</p>}
      {messages.map((message, index) => <div key={index} className="space-y-2">
        <p className="ml-auto w-fit max-w-[90%] rounded-2xl bg-navy px-4 py-2 text-sm text-white">{message.question}</p>
        <p className="max-w-[90%] whitespace-pre-line rounded-2xl bg-mist px-4 py-3 text-sm text-navy">{message.answer}</p>
      </div>)}</div>
      <div className="mb-3 flex flex-wrap gap-2">{prompts.map(prompt => <button key={prompt} type="button" disabled={!rows}
        onClick={() => send(prompt)} className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-emerald hover:text-emerald disabled:opacity-50">{prompt}</button>)}</div>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); send(question); }}>
        <input aria-label="Ask the PayPulse assistant" value={question} onChange={e => setQuestion(e.target.value)}
          placeholder={rows ? "Ask about your invoices…" : "Loading your invoices…"} disabled={!rows}
          className={"min-w-0 flex-1 " + input} />
        <button type="submit" className={button} disabled={!rows || !question.trim()}>Ask</button>
      </form></div>
    <p className="text-xs text-slate-500">Assistant preview uses simple invoice-based guidance; it is not legal, accounting, or financial advice.</p>
  </div>;
}

const defaultSettings = { businessName: "", email: "", currency: "INR", paymentReminders: true, weeklySummary: false };
export function Settings() {
  const [form, setForm] = useState(defaultSettings);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("paypulse-settings");
      if (saved) setForm({ ...defaultSettings, ...JSON.parse(saved) });
      setLoaded(true);
    } catch {
      setError("Could not load saved settings from this browser.");
      setLoaded(true);
    }
  }, []);
  const save = e => {
    e.preventDefault();
    try {
      window.localStorage.setItem("paypulse-settings", JSON.stringify(form));
      setError(""); setMessage("Settings saved in this browser.");
    } catch {
      setMessage(""); setError("Could not save settings. Check your browser storage permissions.");
    }
  };
  return <div className="space-y-5"><div><h1 className="text-2xl font-extrabold">Settings</h1>
    <p className="mt-1 text-sm text-slate-500">Manage your local business profile and notification preferences.</p></div>
    <Message error>{error}</Message><Message>{message}</Message>
    <form onSubmit={save} className={card + " max-w-2xl space-y-5"}>
      <fieldset disabled={!loaded} className="space-y-4"><legend className="mb-2 font-bold">Business profile</legend>
        <label className="block text-sm font-medium text-slate-600">Business name<input value={form.businessName}
          onChange={e => setForm(previous => ({ ...previous, businessName: e.target.value }))} placeholder="Your business name"
          className={"mt-1 w-full " + input} /></label>
        <label className="block text-sm font-medium text-slate-600">Contact email<input type="email" value={form.email}
          onChange={e => setForm(previous => ({ ...previous, email: e.target.value }))} placeholder="you@example.com"
          className={"mt-1 w-full " + input} /></label>
        <label className="block text-sm font-medium text-slate-600">Display currency<select value={form.currency}
          onChange={e => setForm(previous => ({ ...previous, currency: e.target.value }))} className={"mt-1 w-full " + input}>
          <option value="INR">Indian Rupee (INR)</option><option value="USD">US Dollar (USD)</option></select></label>
      </fieldset>
      <fieldset disabled={!loaded} className="space-y-3"><legend className="mb-2 font-bold">Preferences</legend>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={form.paymentReminders}
          onChange={e => setForm(previous => ({ ...previous, paymentReminders: e.target.checked }))} className="mt-1 accent-emerald" />
          <span><span className="font-medium">Payment reminders</span><span className="block text-slate-500">Preference for payment follow-up reminders.</span></span></label>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={form.weeklySummary}
          onChange={e => setForm(previous => ({ ...previous, weeklySummary: e.target.checked }))} className="mt-1 accent-emerald" />
          <span><span className="font-medium">Weekly summary</span><span className="block text-slate-500">Preference for a weekly business summary.</span></span></label>
      </fieldset>
      <button type="submit" className={button} disabled={!loaded}>Save settings</button>
      <p className="text-xs text-slate-500">Settings are stored locally in this browser and are not synced to an account.</p>
    </form>
  </div>;
}
