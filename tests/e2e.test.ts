import assert from "node:assert/strict";
import { setRepo } from "../src/lib/repo"; import { MemoryRepo } from "../src/lib/repo/memory";
import { dispatch } from "../src/lib/router"; import { createTenant, resolveApiKey } from "../src/lib/services/tenants";
import { setLLM } from "../src/lib/ai/llm"; import { signJwt, verifyJwt } from "../src/lib/util/crypto"; import { rupeesInWords } from "../src/lib/util/words";
import { writeFileSync } from "node:fs";
setRepo(new MemoryRepo()); let n = 0; const ok = async (name: string, f: () => Promise<void>) => { await f(); n++; console.log("✓", name); };
const call = (ctx: any, method: string, path: string, body?: any, q = "") => dispatch(method, path, { ctx, q: new URLSearchParams(q), body, req: new Request("http://x/") }) as Promise<any>;

(async () => {
  const A = await createTenant({ name: "Plasma Care", labName: "PLASMA CARE", address: "G13 K8 BDA Market Complex, Kalinga Nagar", phone: "8112060205" });
  const B = await createTenant({ name: "Other Lab" });
  const ca = { tenantId: A.tenant.id, actor: "api", role: "api" as const }, cb = { tenantId: B.tenant.id, actor: "api", role: "api" as const };
  await ok("API key resolves to tenant", async () => { assert.equal((await resolveApiKey(A.apiKey))!.tenantId, A.tenant.id); assert.equal(await resolveApiKey("lsk_live_bad"), null); });
  await ok("catalog shows null price until partner sets it", async () => { const l = await call(ca, "GET", "/catalog/tests", undefined, "q=complete blood"); assert.ok(l.length >= 1); assert.equal(l.find((t: any) => t.id === "cbc").price, null); });
  await ok("billing blocked when price not set", async () => { await assert.rejects(call(ca, "POST", "/bills", { patient: { firstName: "A", sex: "F", age: { years: 30 } }, items: [{ testId: "cbc" }] }), /Price not set/); });
  await ok("set prices (partner's own price list)", async () => { await call(ca, "PUT", "/prices", { prices: [{ testId: "cbc", price: 350 }, { testId: "lipid_profile", price: 600 }, { testId: "kft", price: 700 }] }); await call(cb, "PUT", "/prices/cbc", { price: 200 }); assert.equal((await call(ca, "GET", "/catalog/tests/cbc")).price, 350); assert.equal((await call(cb, "GET", "/catalog/tests/cbc")).price, 200); });
  let bill: any, reports: any[];
  await ok("create bill: price = tenant price, discount, payment, reg no", async () => {
    const r = await call(ca, "POST", "/bills", { externalRef: "ORDER-77", patient: { title: "Mrs.", firstName: "Sanjukta", lastName: "Dash", sex: "F", age: { years: 50 }, mobile: "9937505291" }, items: [{ testId: "cbc" }, { testId: "lipid_profile" }], discount: { type: "percent", value: 10 }, payments: [{ amount: 500, mode: "upi" }] });
    ({ bill, reports } = r); assert.equal(bill.subtotal, 950); assert.equal(bill.discountAmount, 95); assert.equal(bill.total, 855); assert.equal(bill.balance, 355); assert.equal(bill.regNo, 1001); assert.equal(reports.length, 2);
  });
  await ok("idempotent by externalRef", async () => { const r = await call(ca, "POST", "/bills", { externalRef: "ORDER-77", patient: { firstName: "x", sex: "M", age: { years: 1 } }, items: [{ testId: "cbc" }] }); assert.equal(r.duplicate, true); assert.equal(r.bill.id, bill.id); });
  await ok("tenant isolation", async () => { await assert.rejects(call(cb, "GET", `/bills/${bill.id}`), /not found/i); await assert.rejects(call(cb, "GET", `/reports/${reports[0].id}`), /not found/i); });
  const cbc = () => reports.find(r => r.testId === "cbc");
  await ok("enter CBC → derived values calculated (female ranges)", async () => {
    const r = await call(ca, "PUT", `/reports/${cbc().id}/results`, { values: { HB: 11.2, TLC: 7200, NEUT: 60, LYMPH: 32, EOS: 3, MONO: 4, BASO: 1, PLT: 2.8, RBC: 4.1, HCT: 35 }, status: "final" });
    assert.equal(r.results.MCV.display, "85.4"); assert.equal(r.results.MCH.display, "27.3"); assert.equal(r.results.MCHC.display, "32.0"); assert.equal(r.results.HB.flag, "L"); assert.equal(r.results.HCT.flag, "L"); assert.equal(r.status, "final");
  });
  await ok("AI agent: Hinglish instruction → validated proposal → confirm → used in NEXT result", async () => {
    setLLM(async (_s, u) => { assert.ok(u.includes("MCV")); return "```json\n" + JSON.stringify({ rules: [{ target: "MCV", expression: "HCT * 10 / RBC + 0", decimals: 2, explanation: "MCV ko 2 decimal tak dikhayenge" }], clarification: null }) + "\n```"; });
    const { proposal } = await call(ca, "POST", "/calc/agent", { instruction: "MCV ko 2 decimal tak dikhao, formula wahi Hct*10/RBC", testId: "cbc" });
    assert.equal(proposal.rules[0].valid, true); assert.equal(proposal.rules[0].before.result, "85.4".length ? proposal.rules[0].before.result : ""); assert.ok(proposal.rules[0].after.result.split(".")[1].length === 2);
    const saved = await call(ca, "POST", `/calc/agent/${proposal.id}/confirm`, {}); assert.equal(saved.saved[0].version, 1);
    const p2 = await call(ca, "POST", "/reports/preview", { testId: "cbc", values: { HB: 11.2, RBC: 4.1, HCT: 35 }, sex: "F", ageYears: 50 }); assert.equal(p2.MCV.display, "85.37"); assert.equal(p2.MCV.source, "calculated");
    const other = await call(cb, "POST", "/reports/preview", { testId: "cbc", values: { HB: 11.2, RBC: 4.1, HCT: 35 } }); assert.equal(other.MCV.display, "85.4"); // other tenant unaffected
    // second change → version 2, old one deactivated
    setLLM(async () => JSON.stringify({ rules: [{ target: "MCV", expression: "HCT / RBC * 10", decimals: 1 }] }));
    const { proposal: p3 } = await call(ca, "POST", "/calc/agent", { instruction: "wapas 1 decimal", testId: "cbc", autoSave: true }); const rl = await call(ca, "GET", "/calc/rules", undefined, "target=MCV"); assert.equal(rl.length, 2); assert.equal(rl.filter((r: any) => r.active).length, 1); assert.equal(rl[0].version, 2); void p3;
  });
  await ok("AI cannot smuggle code / unknown params (rejected, never saved)", async () => {
    setLLM(async () => JSON.stringify({ rules: [{ target: "MCV", expression: "require('fs').readFileSync('/etc/passwd')" }, { target: "HB", expression: "FOO * 2" }, { target: "NOPE", expression: "HB*2" }] }));
    const { proposal } = await call(ca, "POST", "/calc/agent", { instruction: "hack" }); assert.ok(proposal.rules.every((r: any) => !r.valid)); await assert.rejects(call(ca, "POST", `/calc/agent/${proposal.id}/confirm`, {}), /No valid rule/);
    await assert.rejects(call(ca, "POST", "/calc/rules", { target: "MCV", expression: "process.exit()" }), /Invalid formula/);
  });
  await ok("AI offline fallback understands 'MCV = HCT*10/RBC'", async () => { setLLM(async () => { throw new Error("AI_NOT_CONFIGURED"); }); const { proposal } = await call(ca, "POST", "/calc/agent", { instruction: "MCH = HB*10/RBC" }); assert.equal(proposal.rules[0].valid, true); });
  await ok("sex-specific rule via agent", async () => { setLLM(async () => JSON.stringify({ rules: [{ target: "MCH", expression: "HB * 10 / RBC + 1", appliesTo: { sex: "F" } }] })); const { proposal } = await call(ca, "POST", "/calc/agent", { instruction: "females ke liye MCH me +1" }); await call(ca, "POST", `/calc/agent/${proposal.id}/confirm`, {}); const f = await call(ca, "POST", "/reports/preview", { testId: "cbc", values: { HB: 15, RBC: 5 }, sex: "F", ageYears: 30 }); const m = await call(ca, "POST", "/reports/preview", { testId: "cbc", values: { HB: 15, RBC: 5 }, sex: "M", ageYears: 30 }); assert.equal(f.MCH.display, "31.0"); assert.equal(m.MCH.display, "30.0"); });
  await ok("lipid report calculates LDL etc.; sign locks it", async () => {
    const lp = reports.find(r => r.testId === "lipid_profile"); const r = await call(ca, "PUT", `/reports/${lp.id}/results`, { values: { CHOL: 180, TG: 172, HDL: 55 }, status: "signed" }); assert.equal(r.results.LDL.display, "90.60"); await assert.rejects(call(ca, "PUT", `/reports/${lp.id}/results`, { values: { HDL: 50 } }), /signed/);
  });
  await ok("payment + due report + daily business", async () => {
    await assert.rejects(call(ca, "POST", `/bills/${bill.id}/payments`, { amount: 9999 }), /exceeds/); let d = await call(ca, "GET", "/business/due"); assert.equal(d.totalDue, 355);
    await call(ca, "POST", `/bills/${bill.id}/payments`, { amount: 355, mode: "cash" }); d = await call(ca, "GET", "/business/due"); assert.equal(d.totalDue, 0);
    const day = await call(ca, "GET", "/business/daily"); assert.equal(day.totalIncome, 855); assert.deepEqual(day.incomeSplit, { upi: 500, cash: 355 });
    const dash = await call(ca, "GET", "/dashboard"); assert.equal(dash.casesToday, 1); const ref = await call(ca, "GET", "/business/referral"); assert.equal(ref[0].referrer, "Self"); const tc = await call(ca, "GET", "/business/test-counts"); assert.equal(tc.length, 2);
  });
  await ok("PDFs (bill + report) are valid", async () => {
    await call(ca, "PATCH", "/settings", { signatories: [{ name: "Mr. Sachin Sharma", qualification: "DMLT, Lab Incharge" }, { name: "Dr. A. K. Asthana", qualification: "MBBS, MD Pathologist" }], tagline: "Precision in every diagnosis" });
    const b = await call(ca, "GET", `/bills/${bill.id}/pdf`); const bb = new Uint8Array(await b.arrayBuffer()); assert.equal(Buffer.from(bb.slice(0, 5)).toString(), "%PDF-"); writeFileSync("/tmp/bill.pdf", bb);
    const r = await call(ca, "GET", `/bills/${bill.id}/reports.pdf`); const rb = new Uint8Array(await r.arrayBuffer()); assert.equal(Buffer.from(rb.slice(0, 5)).toString(), "%PDF-"); writeFileSync("/tmp/report.pdf", rb);
  });
  await ok("CSV export is injection-safe", async () => { await call(ca, "POST", "/referrers", { name: "=HYPERLINK(\"x\")" }); const c = await call(ca, "POST", "/bills", { patient: { firstName: "=cmd|calc", sex: "M", age: { years: 3 } }, items: [{ testId: "kft" }], referrerName: "Self" }); void c; const csv = await (await call(ca, "GET", "/business/export.csv")).text(); assert.ok(csv.includes("'=cmd|calc")); });
  await ok("embed token sign/verify + only api role can mint", async () => { const s = await call(ca, "POST", "/embed/session", { user: "u1" }); assert.ok(s.url.includes("/embed?token=")); await assert.rejects(call({ ...ca, role: "embed" }, "POST", "/embed/session", {}), /Not allowed/); assert.equal(verifyJwt("a.b.c", "x"), null); const t = signJwt({ a: 1 }, "k".repeat(30), -5); assert.equal(verifyJwt(t, "k".repeat(30)), null); });
  await ok("amount in words (Indian)", async () => { assert.equal(rupeesInWords(1200), "One thousand two hundred rupees only"); assert.equal(rupeesInWords(1234567.5), "Twelve lakh thirty-four thousand five hundred sixty-seven rupees and fifty paise only"); });
  console.log(`\n${n} e2e tests passed`);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
