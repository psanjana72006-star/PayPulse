import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, FileText, Wallet, MessageSquare, Zap, LineChart, Gauge, Bot, Settings, Activity } from "lucide-react";
const nav = [["", "Overview", LayoutDashboard], ["invoices", "Invoices", FileText], ["payments", "Payments", Wallet],
  ["follow-ups", "AI Follow-ups", MessageSquare], ["instant-cash", "Instant Cash", Zap], ["cash-flow", "Cash Flow", LineChart],
  ["credit-score", "Credit Score", Gauge], ["assistant", "AI Assistant", Bot], ["settings", "Settings", Settings]];
export default function AppLayout() {
  return (<div className="min-h-screen md:flex">
    <aside className="bg-navy p-3 text-white md:min-h-screen md:w-60 md:p-5">
      <Link to="/" className="mb-4 flex items-center gap-2 text-lg font-extrabold md:mb-8"><Activity className="text-emerald" />PayPulse</Link>
      <nav className="flex gap-1 overflow-x-auto md:flex-col">{nav.map(([to, label, Icon]) =>
        <NavLink key={to} to={"/app/" + to} end={to === ""} className={({ isActive }) =>
          "flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition " + (isActive ? "bg-emerald text-white" : "text-slate-300 hover:bg-white/10")}>
          <Icon size={18} />{label}</NavLink>)}</nav></aside>
    <main className="flex-1 p-5 md:p-8"><Outlet /></main></div>);
}
