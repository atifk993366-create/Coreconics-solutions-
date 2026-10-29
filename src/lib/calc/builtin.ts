import type { CalcRule } from "../types";
// Default (textbook) formulas. A tenant's saved rule (AI agent / manual) always takes priority over these.
type B = { target: string; expression: string; decimals?: number; explanation: string };
export const BUILTIN: B[] = [
  { target: "MCV", expression: "HCT * 10 / RBC", decimals: 1, explanation: "MCV (fL) = Hct(%) × 10 / RBC (million/µL)" },
  { target: "MCH", expression: "HB * 10 / RBC", decimals: 1, explanation: "MCH (pg) = Hb (g/dL) × 10 / RBC (million/µL)" },
  { target: "MCHC", expression: "HB * 100 / HCT", decimals: 1, explanation: "MCHC (g/dL) = Hb (g/dL) × 100 / Hct (%)" },
  ...(["NEUT", "LYMPH", "EOS", "MONO", "BASO"] as const).map(c => ({ target: `ABS_${c}`, expression: `${c} / 100 * TLC`, decimals: 0, explanation: `Absolute ${c} = ${c}% / 100 × Total WBC` })),
  { target: "BUN", expression: "UREA * 0.467", decimals: 2, explanation: "BUN = Urea × 0.467 (Urea / 2.14)" },
  { target: "UREA_CREAT", expression: "UREA / CREAT", decimals: 2, explanation: "Urea / Creatinine ratio" },
  { target: "BUN_CREAT", expression: "BUN / CREAT", decimals: 2, explanation: "BUN / Creatinine ratio" },
  { target: "EGFR", decimals: 2, explanation: "CKD-EPI 2021 (race-free) eGFR in ml/min/1.73m²",
    expression: "142 * pow(min(CREAT / if(SEX_F, 0.7, 0.9), 1), if(SEX_F, -0.241, -0.302)) * pow(max(CREAT / if(SEX_F, 0.7, 0.9), 1), -1.2) * pow(0.9938, AGE) * if(SEX_F, 1.012, 1)" },
  { target: "EGFR_CAT", decimals: 0, explanation: "KDIGO GFR category",
    expression: 'if(EGFR >= 90, "G1", if(EGFR >= 60, "G2", if(EGFR >= 45, "G3a", if(EGFR >= 30, "G3b", if(EGFR >= 15, "G4", "G5")))))' },
  { target: "BILI_I", expression: "BILI_T - BILI_D", decimals: 2, explanation: "Indirect bilirubin = Total − Direct" },
  { target: "GLOB", expression: "PROT - ALB", decimals: 2, explanation: "Globulin = Total protein − Albumin" },
  { target: "AG", expression: "ALB / GLOB", decimals: 2, explanation: "A/G ratio" },
  { target: "VLDL", expression: "TG / 5", decimals: 2, explanation: "VLDL = TG / 5 (Friedewald)" },
  { target: "LDL", expression: "if(TG < 400, CHOL - HDL - TG / 5, null)", decimals: 2, explanation: "LDL (Friedewald) = TC − HDL − TG/5, valid only for TG < 400 mg/dL" },
  { target: "NONHDL", expression: "CHOL - HDL", decimals: 2, explanation: "Non-HDL = TC − HDL" },
  { target: "LDL_HDL", expression: "LDL / HDL", decimals: 2, explanation: "LDL / HDL ratio" },
  { target: "CHOL_HDL", expression: "CHOL / HDL", decimals: 2, explanation: "TC / HDL ratio" },
  { target: "TG_HDL", expression: "TG / HDL", decimals: 2, explanation: "TG / HDL ratio" },
  { target: "TSAT", expression: "IRON / TIBC * 100", decimals: 1, explanation: "Transferrin saturation % = Iron / TIBC × 100" },
  { target: "UIBC", expression: "TIBC - IRON", decimals: 0, explanation: "UIBC = TIBC − Iron" },
  { target: "EAG", expression: "28.7 * HBA1C - 46.7", decimals: 2, explanation: "eAG (mg/dL) = 28.7 × HbA1c − 46.7" },
  { target: "INR", expression: "pow(PT_PATIENT / PT_CONTROL, ISI)", decimals: 2, explanation: "INR = (PT patient / PT control) ^ ISI" },
  { target: "ACR", expression: "MALB / UCREAT * 100", decimals: 2, explanation: "Albumin/Creatinine ratio (mg/g) = Microalbumin (mg/L) / Creatinine (mg/dL) × 100" },
];
// "null" literal support: treat NULL variable as absent -> handled by engine via vars.NULL undefined => MissingVar => not computable
export const builtinRules = (): CalcRule[] => BUILTIN.map((b, i) => ({
  id: `builtin:${b.target}`, tenantId: "*", target: b.target, expression: b.expression, decimals: b.decimals, priority: 0, version: 1,
  active: true, source: "builtin" as const, explanation: b.explanation, createdAt: "2024-01-01T00:00:00.000Z",
}));
