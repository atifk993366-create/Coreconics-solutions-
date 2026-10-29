import { getRepo } from "../repo";
<<<<<<< HEAD
import { ApiError, type ApiCtx, type Agent, type Bill, type Expense, type Patient, type Referrer, type Report } from "../types";
import { dateInTz, money, need, nowIso, numv, requireRole, str } from "./util";
=======
import { ApiError, type ApiCtx, type Agent, type Bill, type Expense, type PaymentDoc, type Patient, type Referrer, type Report } from "../types";
import { byDateRange, dateInTz, money, need, nowIso, numv, requireRole, str } from "./util";
>>>>>>> ea8dfb41dbaa7fd42ed7adf7a501661796fa8fdd
import { newId } from "../util/crypto";
import { searchBills } from "./billing";
import { listReports } from "./reports";

const sum = (a: number[]) => money(a.reduce((x, y) => x + y, 0));
export async function transactions(tid: string, f: { from?: string; to?: string; mode?: string; centre?: string }) {
<<<<<<< HEAD
  const bills = await searchBills(tid, { from: f.from, to: f.to, limit: 2000 }); // by bill date (see note in docs)
  const all = await getRepo().query<Bill>("bills", { where: [["tenantId", "==", tid]], limit: 5000 });
  const rows = all.flatMap(b => b.payments.map(p => ({ billId: b.id, regNo: b.regNo, patient: `${b.patient.firstName} ${b.patient.lastName ?? ""}`.trim(), referredBy: b.referrerName, date: dateInTz(p.at), at: p.at, amount: p.amount, mode: p.mode, centre: b.collectionCentre, by: p.by })))
    .filter(r => (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to) && (!f.mode || r.mode === f.mode) && (!f.centre || r.centre === f.centre));
  void bills; return rows.sort((a, b) => b.at.localeCompare(a.at));
=======
  const from = f.from ?? dateInTz(), to = f.to ?? from;
  const rows = (await byDateRange<PaymentDoc>("payments", tid, from, to)).filter(r => !r.cancelled && (!f.mode || r.mode === f.mode) && (!f.centre || r.centre === f.centre));
  return rows.map(r => ({ billId: r.billId, regNo: r.regNo, patient: r.patient, referredBy: r.referredBy, date: r.date, at: r.at, amount: r.amount, mode: r.mode, centre: r.centre, by: r.by })).sort((a, b) => b.at.localeCompare(a.at));
>>>>>>> ea8dfb41dbaa7fd42ed7adf7a501661796fa8fdd
}
export async function dailyBusiness(tid: string, date: string) {
  const [tx, bills, exp] = await Promise.all([transactions(tid, { from: date, to: date }), searchBills(tid, { from: date, to: date, limit: 2000 }), listExpenses(tid, date, date)]);
  const by: Record<string, number> = {}; for (const t of tx) by[t.mode] = money((by[t.mode] ?? 0) + t.amount);
  const income = sum(tx.map(t => t.amount)); const expenses = sum(exp.map(e => e.amount));
  return { date, totalIncome: income, expenses, netIncome: money(income - expenses), incomeSplit: by, bills: bills.filter(b => !b.cancelled).length, cancelled: bills.filter(b => b.cancelled).length, transactions: tx, expenseRows: exp };
}
export async function dueReport(tid: string, from?: string, to?: string) {
  const rows = (await searchBills(tid, { from, to, hasDue: true, limit: 2000 })).map(b => ({ billId: b.id, regNo: b.regNo, date: b.date, patient: `${b.patient.firstName} ${b.patient.lastName ?? ""}`.trim(), mobile: b.patient.mobile, referredBy: b.referrerName, total: b.total, paid: b.paid, due: b.balance }));
  return { rows, totalDue: sum(rows.map(r => r.due)) };
}
export async function referralBusiness(tid: string, from?: string, to?: string) {
  const bills = (await searchBills(tid, { from, to, limit: 5000 })).filter(b => !b.cancelled); const m = new Map<string, { referrer: string; referrerId?: string; cases: number; patients: Set<string>; gross: number; net: number }>();
  for (const b of bills) { const k = b.referrerId ?? b.referrerName; const e = m.get(k) ?? { referrer: b.referrerName, referrerId: b.referrerId, cases: 0, patients: new Set<string>(), gross: 0, net: 0 }; e.cases++; e.patients.add(b.patientId ?? b.patient.firstName); e.gross += b.subtotal; e.net += b.total; m.set(k, e); }
  return [...m.values()].map(e => ({ referrer: e.referrer, referrerId: e.referrerId, cases: e.cases, patients: e.patients.size, gross: money(e.gross), net: money(e.net) })).sort((a, b) => b.net - a.net);
}
export async function caseWise(tid: string, f: { date: string; centre?: string; caseTypes?: string[]; excludeCancelled?: boolean }) {
  const bills = (await searchBills(tid, { from: f.date, to: f.date, centre: f.centre, limit: 3000 })).filter(b => !(f.excludeCancelled && b.cancelled) && (!f.caseTypes?.length || b.caseTypes.some(c => f.caseTypes!.includes(c))));
  const by: Record<string, { cases: number; amount: number }> = {}; for (const b of bills) for (const c of b.caseTypes) { by[c] ??= { cases: 0, amount: 0 }; by[c].cases++; by[c].amount = money(by[c].amount + b.total / b.caseTypes.length); }
  return { date: f.date, byCaseType: by, bills: bills.length, total: sum(bills.map(b => b.total)) };
}
export async function testCounts(tid: string, from: string, to: string) {
  const bills = (await searchBills(tid, { from, to, limit: 5000 })).filter(b => !b.cancelled); const m = new Map<string, { name: string; count: number; revenue: number }>();
  for (const b of bills) for (const i of b.items) { const e = m.get(i.testId) ?? { name: i.name, count: 0, revenue: 0 }; e.count++; e.revenue = money(e.revenue + i.price); m.set(i.testId, e); }
  return [...m.entries()].map(([testId, v]) => ({ testId, ...v })).sort((a, b) => b.count - a.count);
}
export async function exportBillsCsv(tid: string, from?: string, to?: string): Promise<string> {
  const esc = (v: unknown) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; // CSV-injection safe
  const rows = await searchBills(tid, { from, to, limit: 5000 });
  return ["Reg No,Date,Patient,Age,Sex,Mobile,Referred By,Centre,Tests,Subtotal,Discount,Total,Paid,Due,Cancelled", ...rows.map(b => [b.regNo, b.date, `${b.patient.firstName} ${b.patient.lastName ?? ""}`.trim(), b.patient.ageYears, b.patient.sex, b.patient.mobile, b.referrerName, b.collectionCentre, b.items.map(i => i.name).join(" | "), b.subtotal, b.discountAmount, b.total, b.paid, b.balance, b.cancelled].map(esc).join(","))].join("\n");
}
export async function dashboard(tid: string) {
  const today = dateInTz(); const [d, due, reps] = await Promise.all([dailyBusiness(tid, today), dueReport(tid), listReports(tid, { date: today, limit: 1000 })]);
  const rs: Record<string, number> = { new: 0, in_progress: 0, final: 0, signed: 0 }; reps.forEach((r: Report) => rs[r.status]++);
  return { today, casesToday: d.bills, incomeToday: d.totalIncome, paymentsDue: due.totalDue, dueBills: due.rows.slice(0, 5), recentTransactions: d.transactions.slice(0, 5), reportStatus: rs };
}
// ── simple tenant-scoped CRUD: referrers / agents / expenses / patients ──
export async function listReferrers(tid: string, q?: { name?: string; active?: boolean }) { let r = await getRepo().query<Referrer>("referrers", { where: [["tenantId", "==", tid]] }); if (!r.some(x => x.name === "Self")) r = [{ id: "self", tenantId: tid, name: "Self", active: true, createdAt: "" }, ...r]; return r.filter(x => (!q?.name || x.name.toLowerCase().startsWith(q.name.toLowerCase())) && (q?.active === undefined || x.active === q.active)).sort((a, b) => a.name.localeCompare(b.name)); }
export async function saveReferrer(ctx: ApiCtx, b: any): Promise<Referrer> { requireRole(ctx, "owner", "staff", "api", "embed"); const id = b.id && b.id !== "self" ? String(b.id) : newId("ref_"); const old = b.id ? await getRepo().get<Referrer>("referrers", id) : null; if (old && old.tenantId !== ctx.tenantId) throw new ApiError(404, "Referrer not found", "not_found"); const r: Referrer = { id, tenantId: ctx.tenantId, name: str(b.name, "name"), contact: b.contact, address: b.address, active: b.active !== false, createdAt: old?.createdAt ?? nowIso() }; await getRepo().set("referrers", id, r); return r; }
export async function listAgents(tid: string) { return getRepo().query<Agent>("agents", { where: [["tenantId", "==", tid]] }); }
export async function saveAgent(ctx: ApiCtx, b: any): Promise<Agent> { requireRole(ctx, "owner", "staff", "api", "embed"); const a: Agent = { id: b.id ?? newId("ag_"), tenantId: ctx.tenantId, name: str(b.name, "name"), active: b.active !== false, createdAt: nowIso() }; await getRepo().set("agents", a.id, a); return a; }
<<<<<<< HEAD
export async function listExpenses(tid: string, from?: string, to?: string) { return (await getRepo().query<Expense>("expenses", { where: [["tenantId", "==", tid]] })).filter(e => (!from || e.date >= from) && (!to || e.date <= to)).sort((a, b) => b.date.localeCompare(a.date)); }
=======
export async function listExpenses(tid: string, from?: string, to?: string) { return (await byDateRange<Expense>("expenses", tid, from, to)).sort((a, b) => b.date.localeCompare(a.date)); }
>>>>>>> ea8dfb41dbaa7fd42ed7adf7a501661796fa8fdd
export async function addExpense(ctx: ApiCtx, b: any): Promise<Expense> { requireRole(ctx, "owner", "staff", "api"); const e: Expense = { id: newId("ex_"), tenantId: ctx.tenantId, date: str(b.date ?? dateInTz(), "date", { max: 10 }), name: str(b.name, "name"), amount: numv(b.amount, "amount", { min: 0.01 }), category: str(b.category ?? "General", "category", { max: 50 }), mode: str(b.mode ?? "cash", "mode", { max: 20 }), notes: b.notes, createdAt: nowIso() }; await getRepo().set("expenses", e.id, e); return e; }
export async function listPatients(tid: string, f: { name?: string; mobile?: string; uhid?: number }) { return (await getRepo().query<Patient>("patients", { where: [["tenantId", "==", tid]], limit: 2000 })).filter(p => (!f.name || `${p.firstName} ${p.lastName ?? ""}`.toLowerCase().includes(f.name.toLowerCase())) && (!f.mobile || p.mobile?.includes(f.mobile)) && (!f.uhid || p.uhid === f.uhid)).sort((a, b) => b.uhid - a.uhid).slice(0, 200); }
export { need };
