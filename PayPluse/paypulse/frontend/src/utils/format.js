export const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
export const statusStyle = { Paid: "bg-emerald/10 text-emerald", Pending: "bg-amber-100 text-amber-700",
  Overdue: "bg-red-100 text-red-600", "Financing Requested": "bg-blue-100 text-blue-700" };
