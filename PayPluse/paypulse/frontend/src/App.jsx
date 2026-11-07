import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing"; import AppLayout from "./layouts/AppLayout";
import Overview from "./pages/Overview"; import Invoices from "./pages/Invoices";
import { Assistant, CashFlow, CreditScore, FollowUps, InstantCash, Payments, Settings } from "./pages/Workspace";
export default function App() {
  return (<Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/app" element={<AppLayout />}>
      <Route index element={<Overview />} />
      <Route path="invoices" element={<Invoices />} />
      <Route path="payments" element={<Payments />} />
      <Route path="follow-ups" element={<FollowUps />} />
      <Route path="instant-cash" element={<InstantCash />} />
      <Route path="cash-flow" element={<CashFlow />} />
      <Route path="credit-score" element={<CreditScore />} />
      <Route path="assistant" element={<Assistant />} />
      <Route path="settings" element={<Settings />} />
    </Route></Routes>);
}
