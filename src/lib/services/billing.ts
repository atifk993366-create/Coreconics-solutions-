import { getRepo } from "../repo";
import { ApiError, type PaymentDoc, type ApiCtx, type Bill, type BillItem, type Patient, type PatientSnap, type Payment, type Report, type Sex, type Referrer } from "../types";
import { allTests, listPackages, priceMap } from "./catalog";
import { byDateRange, dateInTz, money, need, nowIso, numv, str } from "./util";
import { newId } from "../util/crypto";
import { getTenant } from "./tenants";

const SEXES: Sex[] = ["M", "F", "O"];
export const CASE_TYPES = ["LAB", "USG", "DIGITAL XRAY", "XRAY", "OUTSOURCE LAB", "ECG", "CT SCAN", "MRI", "EPS", "OPG", "CARDIOLOGY", "EEG", "MAMMOGRAPHY"];

function readPatient(b: any): PatientSnap {
  if (!b || typeof b !== "object") throw new ApiError(400, "patient is required", "validation");
  const sex = String(b.sex ?? "").toUpperCase().charAt(0) as Sex; if (!SEXES.includes(sex)) throw new ApiError(400, "patient.sex must be M, F or O", "validation");
  const age = b.age ?? { years: b.ageYears, months: b.ageMonths, days: b.ageDays };
  const years = numv(age?.years ?? 0, "age.years", { max: 130 }), months = numv(age?.months ?? 0, "age.months", { max: 11 }), days = numv(age?.days ?? 0, "age.days", { max: 30 });
  if (!years && !months && !days) throw new ApiError(400, "patient age is required", "validation");
  const mobile = str(b.mobile, "mobile", { max: 20, required: false });
  return { title: str(b.title, "title", { max: 10, required: false }), firstName: str(b.firstName, "firstName", { max: 80 }), lastName: str(b.lastName, "lastName", { max: 80, required: false }), sex, ageYears: years, ageMonths: months, ageDays: days, mobile, address: str(b.address, "address", { max: 300, required: false }) };
}
async function upsertPatient(tid: string, p: PatientSnap): Promise<Patient> {
  const repo = getRepo();
  if (p.mobile) { const hit = (await repo.query<Patient>("patients", { where: [["tenantId", "==", tid], ["mobile", "==", p.mobile]] })).find(x => x.firstName.toLowerCase() === p.firstName.toLowerCase() && (x.lastName ?? "").toLowerCase() === (p.lastName ?? "").toLowerCase()); if (hit) { const up = { ...hit, ageYears: p.ageYears, address: p.address || hit.address, sex: p.sex }; await repo.set("patients", hit.id, up); return up; } }
  const uhid = await repo.nextCounter(tid, "uhid", 1);
  const pat: Patient = { id: newId("p_"), tenantId: tid, uhid, title: p.title, firstName: p.firstName, lastName: p.lastName, sex: p.sex, ageYears: p.ageYears, mobile: p.mobile, address: p.address, createdAt: nowIso() };
  await repo.set("patients", pat.id, pat); return pat;
}
export function calcTotals(subtotal: number, dType: "percent" | "flat", dVal: number, paid: number) {
  const discountAmount = money(dType === "percent" ? subtotal * Math.min(dVal, 100) / 100 : Math.min(dVal, subtotal));
  const total = money(subtotal - discountAmount); return { discountAmount, total, balance: money(total - paid) };
}

export async function createBill(ctx: ApiCtx, b: any): Promise<{ bill: Bill; reports: Report[]; duplicate?: boolean }> {
  const repo = getRepo(); const tid = ctx.tenantId; const tenant = await getTenant(tid);
  const externalRef = str(b.externalRef, "externalRef", { max: 100, required: false });
  if (externalRef) { const ex = (await repo.query<Bill>("bills", { where: [["tenantId", "==", tid], ["externalRef", "==", externalRef]] }))[0]; if (ex) return { bill: ex, reports: await repo.query<Report>("reports", { where: [["tenantId", "==", tid], ["billId", "==", ex.id]] }), duplicate: true }; }
  const snap = readPatient(b.patient); const patient = await upsertPatient(tid, snap);
  const [tests, prices, pkgs] = await Promise.all([allTests(tid), priceMap(tid), listPackages(tid)]);
  const reqItems: any[] = Array.isArray(b.items) ? b.items : []; if (!reqItems.length) throw new ApiError(400, "items required (at least one test or package)", "validation"); if (reqItems.length > 100) throw new ApiError(400, "too many items", "validation");
  const items: BillItem[] = []; const reportTests: { id: string }[] = []; const seen = new Set<string>();
  for (const it of reqItems) {
    if (it.packageId) {
      const pk = pkgs.find(p => p.id === it.packageId && p.active); if (!pk) throw new ApiError(400, `Unknown package ${it.packageId}`, "unknown_package");
      if (pk.forSex !== "both" && pk.forSex !== snap.sex) throw new ApiError(400, `Package ${pk.name} is not for this patient`, "validation");
      items.push({ testId: pk.id, name: pk.name, kind: "package", price: pk.price }); pk.testIds.forEach(id => reportTests.push({ id }));
    } else {
      const id = String(it.testId ?? ""); const t = tests.find(x => x.id === id && x.active !== false); if (!t) throw new ApiError(400, `Unknown test ${id}`, "unknown_test");
      if (seen.has(id)) continue; seen.add(id); const pr = prices.get(id);
      if (!pr || pr.active === false) throw new ApiError(400, `Price not set for "${t.name}". Set it in your price list first.`, "price_not_set", { testId: id });
      items.push({ testId: id, name: t.name, kind: t.kind === "panel" ? "panel" : t.kind === "culture" ? "culture" : "test", price: pr.price }); reportTests.push({ id });
    }
  }
  const subtotal = money(items.reduce((s, i) => s + i.price, 0));
  const dType = b.discount?.type === "percent" ? "percent" : "flat"; const dVal = numv(b.discount?.value ?? 0, "discount.value");
  const payments: Payment[] = (Array.isArray(b.payments) ? b.payments : []).map((p: any) => ({ amount: numv(p.amount, "payment.amount", { min: 0.01 }), mode: str(p.mode ?? "cash", "mode", { max: 20 }), at: nowIso(), by: ctx.actor, remarks: p.remarks }));
  const paid = money(payments.reduce((s, p) => s + p.amount, 0)); const t = calcTotals(subtotal, dType, dVal, paid);
  if (paid > t.total + 0.001) throw new ApiError(400, "Amount received exceeds bill total", "validation");
  let referrerName = "Self"; let referrerId: string | undefined;
  if (b.referrerId) { const r = need(await repo.get<Referrer>("referrers", String(b.referrerId)), "Referrer"); if (r.tenantId !== tid) throw new ApiError(404, "Referrer not found", "not_found"); referrerId = r.id; referrerName = r.name; } else if (b.referrerName) referrerName = str(b.referrerName, "referrerName");
  const prefix = tenant.settings?.regPrefix ?? ""; void prefix;
  const regNo = await repo.nextCounter(tid, "bill", 1001);
  const bill: Bill = { id: newId("b_"), tenantId: tid, regNo, patientId: patient.id, patient: { ...snap, id: patient.id }, referrerId, referrerName, collectionCentre: str(b.collectionCentre ?? "Main", "collectionCentre"), agentId: b.agentId, agentName: b.agentName,
    date: dateInTz(new Date()), caseTypes: Array.isArray(b.caseTypes) && b.caseTypes.length ? b.caseTypes.map(String) : ["LAB"], items, subtotal, discountType: dType, discountValue: dVal, discountAmount: t.discountAmount, total: t.total, paid, balance: t.balance, payments, cancelled: false, due: t.balance > 0, createdAt: nowIso(), createdBy: ctx.actor, externalRef: externalRef || undefined, remarks: b.remarks };
  await repo.set("bills", bill.id, bill); for (const p of payments) await recordPayment(bill, p);
  const reports: Report[] = [];
  for (const { id } of reportTests) {
    const test = tests.find(x => x.id === id); if (!test) continue; const r: Report = { id: newId("r_"), tenantId: tid, billId: bill.id, regNo, date: bill.date, testId: test.id, testName: test.name, department: test.department, patient: bill.patient, referrerName, results: {}, status: "new", createdAt: nowIso(), updatedAt: nowIso(), collectedAt: nowIso(), receivedAt: nowIso() };
    await repo.set("reports", r.id, r); reports.push(r);
  }
  return { bill, reports };
}
export async function getBill(ctx: ApiCtx, id: string): Promise<Bill> { const b = need(await getRepo().get<Bill>("bills", id), "Bill"); if (b.tenantId !== ctx.tenantId) throw new ApiError(404, "Bill not found", "not_found"); return b; }
export async function addPayment(ctx: ApiCtx, id: string, b: any) {
  const bill = await getBill(ctx, id); if (bill.cancelled) throw new ApiError(400, "Bill is cancelled", "validation");
  const amount = numv(b.amount, "amount", { min: 0.01 }); if (amount > bill.balance + 0.001) throw new ApiError(400, `Amount exceeds balance (${bill.balance})`, "validation");
  const payments = [...bill.payments, { amount, mode: str(b.mode ?? "cash", "mode", { max: 20 }), at: nowIso(), by: ctx.actor, remarks: b.remarks }]; const paid = money(bill.paid + amount);
  const up = { payments, paid, balance: money(bill.total - paid), due: money(bill.total - paid) > 0 }; await getRepo().patch("bills", id, up); await recordPayment(bill, payments[payments.length - 1]); return { ...bill, ...up };
}
export async function cancelBill(ctx: ApiCtx, id: string) {
  const bill = await getBill(ctx, id); await getRepo().patch("bills", id, { cancelled: true, due: false });
  for (const p of await getRepo().query<PaymentDoc>("payments", { where: [["tenantId", "==", ctx.tenantId], ["billId", "==", id]] })) await getRepo().patch("payments", p.id, { cancelled: true });
  return { ...bill, cancelled: true };
}
/** One row per payment (date-indexed) → fast daily business / transactions without scanning all bills. */
async function recordPayment(bill: Bill, p: Payment) {
  const d: PaymentDoc = { id: newId("pay_"), tenantId: bill.tenantId, billId: bill.id, regNo: bill.regNo, patient: `${bill.patient.firstName} ${bill.patient.lastName ?? ""}`.trim(), referredBy: bill.referrerName, centre: bill.collectionCentre, amount: p.amount, mode: p.mode, date: dateInTz(p.at), at: p.at, by: p.by };
  await getRepo().set("payments", d.id, d);
}
export async function searchBills(tid: string, f: { from?: string; to?: string; regNo?: number; name?: string; referrerId?: string; hasDue?: boolean; cancelled?: boolean; centre?: string; limit?: number }) {
  let rows: Bill[];
  if (f.regNo) rows = await getRepo().query<Bill>("bills", { where: [["tenantId", "==", tid], ["regNo", "==", f.regNo]] });
  else if (f.hasDue && !(f.from && f.to)) rows = await getRepo().query<Bill>("bills", { where: [["tenantId", "==", tid], ["due", "==", true]] });
  else rows = await byDateRange<Bill>("bills", tid, f.from, f.to);
  rows = rows.filter(r => (f.name ? `${r.patient.firstName} ${r.patient.lastName ?? ""}`.toLowerCase().includes(f.name.toLowerCase()) : true) && (f.referrerId ? r.referrerId === f.referrerId : true) && (f.hasDue ? r.balance > 0 && !r.cancelled : true) && (f.cancelled !== undefined ? r.cancelled === f.cancelled : true) && (f.centre ? r.collectionCentre === f.centre : true));
  return rows.sort((a, b) => b.regNo - a.regNo).slice(0, f.limit ?? 300);
}
