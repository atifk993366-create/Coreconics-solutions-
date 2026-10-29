// ───────────────────────── Core domain types ─────────────────────────
export type Sex = "M" | "F" | "O";
export type ParamType = "number" | "text" | "option";
export type Dept =
  | "Haematology" | "Biochemistry" | "Serology & Immunology" | "Clinical Pathology"
  | "Cytology" | "Microbiology" | "Endocrinology" | "Histopathology" | "Others" | "Miscellaneous";

export interface RangeDef {
  sex?: Sex | "any";
  ageMin?: number; // years, inclusive
  ageMax?: number; // years, exclusive
  text: string;    // "13 - 17", "< 2", "> 90"
}

export interface ParamDef {
  code: string;            // UPPER_SNAKE, used in formulas (HB, RBC, HCT ...)
  name: string;
  unit?: string;
  ref?: string;            // default reference text
  ranges?: RangeDef[];     // sex/age specific ranges (win over `ref`)
  type: ParamType;
  options?: string[] | null;
  group?: string | null;
  decimals?: number;
  derived?: boolean;       // calculated from other parameters
}

export interface TestDef {
  id: string;
  name: string;
  shortName?: string;
  department: string;
  kind: "test" | "panel" | "culture";
  parameters: ParamDef[];
  interpretation?: string;
  forSex?: "both" | "M" | "F";
  mrp?: number;            // optional global default price (tenants override)
  active?: boolean;
  order?: number;
  tenantId?: string | null; // null = global catalogue, else tenant-private test
}

export interface Package { id: string; tenantId: string; name: string; testIds: string[]; price: number; forSex: "both" | "M" | "F"; active: boolean }

export interface Branding {
  labName: string; address?: string; phone?: string; email?: string;
  logoUrl?: string; tagline?: string; gstin?: string;
  footerNote?: string;
  signatories?: { name: string; qualification?: string; signatureUrl?: string }[];
}

export interface Tenant {
  id: string; name: string; branding: Branding; allowedOrigins: string[];
  plan: string; active: boolean; currency: string; createdAt: string;
  approval?: "pending" | "approved" | "rejected" | "suspended"; ownerEmail?: string; emailVerified?: boolean; approvalNote?: string; approvedAt?: string;
  registration?: { ownerName?: string; phone?: string; city?: string; licenseNo?: string; website?: string };
  settings?: { regPrefix?: string; roundTotals?: boolean };
}

export interface PriceDoc { id: string; tenantId: string; testId: string; price: number; active: boolean }

export interface BillItem { testId: string; name: string; kind: "test" | "panel" | "package" | "culture"; price: number }
export interface Payment { amount: number; mode: string; at: string; by?: string; remarks?: string }

export interface PatientSnap { id?: string; title?: string; firstName: string; lastName?: string; sex: Sex; ageYears: number; ageMonths?: number; ageDays?: number; mobile?: string; address?: string }

export interface Bill {
  id: string; tenantId: string; regNo: number; patientId?: string; patient: PatientSnap;
  referrerId?: string; referrerName: string; collectionCentre: string; agentId?: string; agentName?: string;
  date: string; caseTypes: string[]; items: BillItem[];
  subtotal: number; discountType: "percent" | "flat"; discountValue: number; discountAmount: number;
  total: number; paid: number; balance: number; payments: Payment[];
<<<<<<< HEAD
  cancelled: boolean; createdAt: string; createdBy?: string; externalRef?: string; remarks?: string;
=======
  cancelled: boolean; due?: boolean; createdAt: string; createdBy?: string; externalRef?: string; remarks?: string;
>>>>>>> ea8dfb41dbaa7fd42ed7adf7a501661796fa8fdd
}

export type ReportStatus = "new" | "in_progress" | "final" | "signed";
export interface ResultCell {
  raw?: string | number | null; value: number | string | null; display: string;
  flag: "" | "L" | "H"; source: "entered" | "calculated" | "manual";
  ruleId?: string; ruleVersion?: number; formula?: string; refText?: string; unit?: string;
}
export interface Report {
<<<<<<< HEAD
  id: string; tenantId: string; billId: string; regNo: number; testId: string; testName: string; department: string;
=======
  id: string; tenantId: string; billId: string; regNo: number; date?: string; testId: string; testName: string; department: string;
>>>>>>> ea8dfb41dbaa7fd42ed7adf7a501661796fa8fdd
  patient: PatientSnap; referrerName: string; results: Record<string, ResultCell>;
  status: ReportStatus; notes?: string; interpretation?: string;
  collectedAt?: string; receivedAt?: string; reportedAt?: string; createdAt: string; updatedAt: string;
  signedBy?: string; pdfUrl?: string; manual?: string[]; cultureData?: CultureData;
}
export interface CultureData { sampleType?: string; organism?: string; colonyCount?: string; remarks?: string; sensitivity: { antibiotic: string; result: "Sensitive" | "Resistant" | "Intermediate" | "" }[] }

// ─────────────── Calculation rules (AI agent writes these) ───────────────
export interface RuleScope { sex?: Sex; ageMin?: number; ageMax?: number; testIds?: string[] }
export interface CalcRule {
  id: string; tenantId: string; target: string; expression: string; decimals?: number;
  appliesTo?: RuleScope; priority: number; version: number; active: boolean;
  source: "builtin" | "ai" | "manual"; instruction?: string; explanation?: string;
  createdBy?: string; createdAt: string; supersedes?: string;
}
export interface ApiCtx { tenantId: string; actor: string; role: "owner" | "staff" | "api" | "embed"; scopes?: string[] }
export class ApiError extends Error { constructor(public status: number, message: string, public code = "error", public details?: unknown) { super(message) } }
export interface Patient { id: string; tenantId: string; uhid: number; title?: string; firstName: string; lastName?: string; sex: Sex; ageYears: number; mobile?: string; address?: string; createdAt: string }
export interface Referrer { id: string; tenantId: string; name: string; contact?: string; address?: string; active: boolean; createdAt: string }
export interface Agent { id: string; tenantId: string; name: string; active: boolean; createdAt: string }
export interface Expense { id: string; tenantId: string; date: string; name: string; amount: number; category: string; mode: string; notes?: string; createdAt: string }
export interface TestOverride { id: string; tenantId: string; testId: string; name?: string; interpretation?: string; active?: boolean; parameters?: Record<string, Partial<import("./types").ParamDef>> }
<<<<<<< HEAD
=======
export interface PaymentDoc { id: string; tenantId: string; billId: string; regNo: number; patient: string; referredBy: string; centre: string; amount: number; mode: string; date: string; at: string; by?: string; cancelled?: boolean }
>>>>>>> ea8dfb41dbaa7fd42ed7adf7a501661796fa8fdd
