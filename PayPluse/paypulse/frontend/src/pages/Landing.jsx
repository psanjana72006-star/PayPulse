import { Link } from "react-router-dom";
import { Activity, ScanLine, BellRing, Zap, LineChart, Gauge, Languages, Clock, PhoneCall, Landmark } from "lucide-react";
const problems = [[Clock, "Delayed payments", "Large customers delay payments, leaving small businesses struggling to manage daily expenses."],
  [PhoneCall, "Manual follow-ups", "Owners waste valuable time calling and messaging customers for pending payments."],
  [Landmark, "Limited credit access", "Without verified financial records, banks hesitate to provide affordable loans."]];
const features = [[ScanLine, "Smart invoice capture"], [BellRing, "Automated payment chasing"], [Zap, "Instant invoice financing"],
  [LineChart, "AI cash-flow forecasting"], [Gauge, "Loan-readiness score"], [Languages, "Multilingual AI assistant"]];
export default function Landing() {
  return (<div>
    <header className="sticky top-0 z-10 flex items-center justify-between bg-white/90 px-6 py-4 backdrop-blur">
      <span className="flex items-center gap-2 text-lg font-extrabold"><Activity className="text-emerald" />PayPulse</span>
      <nav className="hidden gap-6 text-sm font-medium md:flex">{[["Features", "features"], ["How it works", "features"], ["Solutions", "features"], ["About", "about"]].map(([n, id]) => <a key={n} href={"#" + id} className="hover:text-emerald">{n}</a>)}</nav>
      <div className="flex gap-2"><Link to="/app" className="px-3 py-2 text-sm font-semibold">Login</Link>
        <Link to="/app" className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald">Get started</Link></div></header>
    <section className="bg-navy px-6 py-20 text-white"><div className="mx-auto max-w-5xl">
      <h1 className="max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">Stop waiting for payments. Start growing your business.</h1>
      <p className="mt-5 max-w-xl text-lg text-slate-300">PayPulse uses AI to track unpaid invoices, follow up with customers, and help small businesses stay financially healthy.</p>
      <div className="mt-8 flex flex-wrap gap-3"><Link to="/app/invoices" className="rounded-xl bg-emerald px-6 py-3 font-semibold">Get started free</Link>
        <Link to="/app" className="rounded-xl border border-white/30 px-6 py-3 font-semibold hover:bg-white/10">Explore dashboard</Link></div></div></section>
    <section className="mx-auto max-w-5xl px-6 py-16"><h2 className="text-3xl font-extrabold">Your business is profitable. So why is your money missing?</h2>
      <div className="mt-8 grid gap-5 md:grid-cols-3">{problems.map(([I, t, d]) => <div key={t} className="rounded-2xl bg-white p-6 shadow-sm"><I className="text-emerald" /><h3 className="mt-3 font-bold">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p></div>)}</div></section>
    <section id="features" className="mx-auto max-w-5xl px-6 pb-16"><h2 className="text-3xl font-extrabold">One AI agent. Your entire payment cycle under control.</h2>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 md:grid-cols-3">{features.map(([I, t]) => <div key={t} className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"><I className="text-emerald" /><h3 className="mt-3 font-bold">{t}</h3></div>)}</div></section>
    <section id="about" className="bg-white px-6 py-12 text-center text-sm text-slate-500"><p className="mx-auto max-w-2xl">Financing figures are illustrative, not offers. Actual financing depends on partner eligibility, fees and terms. PayPulse does not provide loans.</p></section>
    <footer className="bg-navy px-6 py-8 text-center text-sm text-slate-400">© PayPulse. Privacy Policy. Terms and Conditions.</footer></div>);
}
