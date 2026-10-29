import { compute } from "../src/lib/calc/engine";
import { validateExpression, parse, evaluate } from "../src/lib/calc/expr";
import seed from "../src/data/seed-tests.json";
import assert from "node:assert/strict";
const T = (id: string) => (seed as any[]).find(t => t.id === id)!;
let n = 0; const ok = (name: string, f: () => void) => { f(); n++; console.log("✓", name); };

ok("CBC matches Labsmart sample report (Hb15, RBC5, Hct42)", () => {
  const r = compute({ params: T("cbc").parameters, sex: "M", ageYears: 27, values: { HB: 15, TLC: 5100, NEUT: 79, LYMPH: 18, EOS: 1, MONO: 1, BASO: 1, PLT: 3.5, RBC: 5, HCT: 42 } });
  assert.equal(r.MCV.display, "84.0"); assert.equal(r.MCH.display, "30.0"); assert.equal(r.MCHC.display, "35.7"); assert.equal(r.MCHC.flag, "H");
  assert.equal(r.LYMPH.flag, "L"); assert.equal(r.MONO.flag, "L");
});
ok("Absolute counts", () => {
  const r = compute({ params: T("dlc_abs").parameters, values: { NEUT: 60, LYMPH: 30, EOS: 4, MONO: 5, BASO: 1, TLC: 8000 } });
  assert.equal(r.ABS_NEUT.display, "4800"); assert.equal(r.ABS_EOS.display, "320");
});
ok("Lipid profile matches sample (180/172/55)", () => {
  const r = compute({ params: T("lipid_profile").parameters, values: { CHOL: 180, TG: 172, HDL: 55 } });
  assert.equal(r.LDL.display, "90.60"); assert.equal(r.VLDL.display, "34.40"); assert.equal(r.LDL_HDL.display, "1.65"); assert.equal(r.CHOL_HDL.display, "3.27"); assert.equal(r.TG_HDL.display, "3.13"); assert.equal(r.NONHDL.display, "125.00");
});
ok("LDL not computed when TG >= 400", () => { const r = compute({ params: T("lipid_profile").parameters, values: { CHOL: 200, TG: 450, HDL: 40 } }); assert.equal(r.LDL, undefined); });
ok("KFT matches sample: BUN 15.88, eGFR 87.08 (M,28), G2", () => {
  const r = compute({ params: T("kft").parameters, sex: "M", ageYears: 28, values: { UREA: 34, CREAT: 1.17, K: 4 } });
  assert.equal(r.BUN.display, "15.88"); assert.equal(r.EGFR.display, "87.08"); assert.equal(r.EGFR_CAT.display, "G2"); assert.equal(r.UREA_CREAT.display, "29.06");
});
ok("HbA1c 6 -> eAG 125.50", () => { const r = compute({ params: T("hba1c").parameters, values: { HBA1C: 6 } }); assert.equal(r.EAG.display, "125.50"); });
ok("Custom tenant rule overrides builtin and is versioned", () => {
  const rule: any = { id: "r1", tenantId: "t", target: "MCV", expression: "HCT / RBC * 10 + 1", decimals: 2, priority: 10, version: 3, active: true, source: "ai", createdAt: "" };
  const r = compute({ params: T("cbc").parameters, values: { HB: 15, RBC: 5, HCT: 42 }, rules: [rule] });
  assert.equal(r.MCV.display, "85.00"); assert.equal(r.MCV.ruleId, "r1"); assert.equal(r.MCV.ruleVersion, 3);
});
ok("Sex-scoped rule only applies to females", () => {
  const rule: any = { id: "r2", tenantId: "t", target: "MCH", expression: "HB * 10 / RBC + 2", priority: 5, version: 1, active: true, source: "ai", appliesTo: { sex: "F" }, createdAt: "" };
  const m = compute({ params: T("cbc").parameters, sex: "M", values: { HB: 15, RBC: 5 }, rules: [rule] });
  const f = compute({ params: T("cbc").parameters, sex: "F", values: { HB: 15, RBC: 5 }, rules: [rule] });
  assert.equal(m.MCH.display, "30.0"); assert.equal(f.MCH.display, "32.0");
});
ok("Manual override is respected", () => { const r = compute({ params: T("cbc").parameters, values: { HB: 15, RBC: 5, HCT: 42, MCV: 90 }, manual: ["MCV"] }); assert.equal(r.MCV.source, "manual"); assert.equal(r.MCV.display, "90"); });
ok("Missing inputs -> no calc, no crash", () => { const r = compute({ params: T("cbc").parameters, values: { HB: 15 } }); assert.equal(r.MCV, undefined); });
ok("Safety: no code execution / unknown vars / functions", () => {
  assert.equal(validateExpression("process.exit(1)", ["HB"]).ok, false);
  assert.equal(validateExpression("constructor('x')()", ["HB"]).ok, false);
  assert.equal(validateExpression("HB * FOO", ["HB"]).ok, false);
  assert.equal(validateExpression("HB * 10 / RBC", ["HB", "RBC"]).ok, true);
  assert.throws(() => parse("a;b"));
  assert.equal(evaluate(parse("round(10/3, 2)"), {}), 3.33);
  assert.equal(evaluate(parse("HB × 10 ÷ RBC"), { HB: 15, RBC: 5 }), 30);
});
console.log(`\n${n} calc tests passed`);
