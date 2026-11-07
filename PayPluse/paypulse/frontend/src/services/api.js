const B = import.meta.env.VITE_API_URL || "http://localhost:8000";
const j = async (p, o = {}) => { const r = await fetch(B + p, { headers: { "Content-Type": "application/json" }, ...o });
  if (!r.ok) throw new Error("Request failed (" + r.status + ")"); return r.json(); };
export const api = {
  invoices: () => j("/api/invoices"), stats: () => j("/api/invoices/stats/summary"),
  create: (b) => j("/api/invoices", { method: "POST", body: JSON.stringify(b) }),
  update: (id, b) => j("/api/invoices/" + id, { method: "PUT", body: JSON.stringify(b) }),
  remove: (id) => j("/api/invoices/" + id, { method: "DELETE" }),
  extract: (file) => { const f = new FormData(); f.append("file", file); return fetch(B + "/api/ai/extract", { method: "POST", body: f }).then(r => r.json()); },
  forecast: (d) => j("/api/ai/forecast?days=" + d),
  reminder: (stage, invoice) => j("/api/ai/reminder?stage=" + stage + "&number=" + encodeURIComponent(invoice.number)
    + "&amount=" + encodeURIComponent(invoice.amount) + "&customer=" + encodeURIComponent(invoice.customer)),
};
