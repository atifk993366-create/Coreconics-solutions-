import type { Report, Tenant, TestDef } from "../types";
import { A4, M, addPage, barcode, clean, fetchLogo, header, line, newDoc, text, wrap, type Ctx } from "./common";

const COL = { name: M, val: 270, unit: 350, ref: 440 };
export async function reportPdf(reports: Report[], tests: Map<string, TestDef>, tenant: Tenant, opts: { draft?: boolean } = {}): Promise<Uint8Array> {
  const { doc, font, bold } = await newDoc(); const logo = await fetchLogo(doc, tenant.branding.logoUrl); const page = doc.addPage([A4.w, A4.h]);
  const c: Ctx = { doc, page, y: A4.h - M, font, bold, pages: [page], logo };
  for (let ri = 0; ri < reports.length; ri++) {
    const r = reports[ri]; const t = tests.get(r.testId); if (ri > 0) addPage(c);
    await pageTop(c, r, tenant); text(c, r.department.toUpperCase(), A4.w / 2, c.y, 11, { bold: true, right: false }); c.y -= 16; text(c, r.testName.toUpperCase(), A4.w / 2 - 80, c.y, 11, { bold: true }); c.y -= 18;
    header4(c);
    let group: string | null | undefined = undefined;
    for (const p of t?.parameters ?? []) {
      const cell = r.results[p.code]; if (!cell) continue; need(c, 18, r, tenant);
      if ((p.group ?? null) !== group) { group = p.group ?? null; if (group) { text(c, group.toUpperCase(), COL.name, c.y, 9, { bold: true }); c.y -= 13; } }
      const ind = p.group ? 12 : 0; const abn = cell.flag !== "";
      text(c, p.name.toUpperCase(), COL.name + ind, c.y, 9, { maxW: 200 - (cell.flag ? 18 : 0) }); if (cell.flag) text(c, cell.flag, COL.val - 18, c.y, 9, { bold: true, color: [0.8, 0.1, 0.1] });
      text(c, cell.display, COL.val, c.y, 9.5, { bold: abn, color: abn ? [0.8, 0.1, 0.1] : undefined, maxW: 75 }); text(c, cell.unit ?? "", COL.unit, c.y, 9, { maxW: 85 }); text(c, cell.refText ?? "", COL.ref, c.y, 9, { maxW: A4.w - M - COL.ref });
      c.y -= 14;
    }
    if (r.cultureData) { const cd = r.cultureData; for (const l of [`Sample Type: ${cd.sampleType ?? ""}`, `Organism Isolated: ${cd.organism ?? ""}`, `Colony Count: ${cd.colonyCount ?? ""}`]) { need(c, 14, r, tenant); text(c, l, M, c.y, 9.5); c.y -= 14; } c.y -= 4; for (const s of cd.sensitivity.filter(x => x.result)) { need(c, 13, r, tenant); text(c, s.antibiotic, M + 10, c.y, 9); text(c, s.result, COL.ref - 40, c.y, 9, { bold: s.result === "Resistant" }); c.y -= 12.5; } }
    if (r.notes) { c.y -= 6; for (const l of wrap(`Notes: ${r.notes}`, c.font, 8.5, A4.w - 2 * M)) { need(c, 12, r, tenant); text(c, l, M, c.y, 8.5); c.y -= 11; } }
    if (r.interpretation) { c.y -= 6; line(c, c.y + 4); c.y -= 8; for (const l of wrap(r.interpretation, c.font, 8, A4.w - 2 * M)) { need(c, 11, r, tenant); text(c, l, M, c.y, 8, { color: [0.3, 0.3, 0.35] }); c.y -= 10; } }
    c.y -= 10; need(c, 14, r, tenant); text(c, "~~~ End of report ~~~", A4.w / 2 - 55, c.y, 9);
  }
  const n = c.pages.length; c.pages.forEach((pg, i) => { c.page = pg; sign(c, tenant, i + 1, n); if (opts.draft) text(c, "DRAFT - NOT VALID", 120, A4.h / 2, 42, { bold: true, color: [0.9, 0.85, 0.85] }); });
  return doc.save();
}
async function pageTop(c: Ctx, r: Report, tenant: Tenant) {
  await header(c, tenant.branding); const p = r.patient; const name = `${p.title ? p.title + " " : ""}${p.firstName} ${p.lastName ?? ""}`.trim(); const f = (iso?: string, t = false) => iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", ...(t ? { hour: "2-digit", minute: "2-digit", hour12: true } : {}) }) : "";
  const bc = await barcode(c.doc, String(r.regNo)); if (bc) c.page.drawImage(bc, { x: A4.w - M - 90, y: c.y - 24, width: 90, height: 24 });
  text(c, name, M, c.y, 11, { bold: true }); c.y -= 15; const mid = 330;
  const L: [string, string][] = [["Age / Sex", `${p.ageYears} YRS / ${p.sex}`], ["Referred by", r.referrerName], ["Reg. no.", String(r.regNo)]];
  const R: [string, string][] = [["Registered on", f(r.createdAt, true)], ["Collected on", f(r.collectedAt)], ["Received on", f(r.receivedAt)], ["Reported on", f(r.reportedAt, true)]];
  L.forEach(([k, v], i) => { text(c, k, M, c.y - i * 13, 9); text(c, `: ${v}`, M + 70, c.y - i * 13, 9); }); R.forEach(([k, v], i) => { text(c, k, mid, c.y - i * 13, 9); text(c, `: ${v}`, mid + 75, c.y - i * 13, 9); });
  c.y -= 4 * 13 + 4; line(c, c.y, M, A4.w - M, 0.8); c.y -= 20;
}
function header4(c: Ctx) { line(c, c.y + 11, M, A4.w - M, 1, [0, 0, 0]); text(c, "TEST", COL.name, c.y, 9, { bold: true }); text(c, "VALUE", COL.val, c.y, 9, { bold: true }); text(c, "UNIT", COL.unit, c.y, 9, { bold: true }); text(c, "REFERENCE", COL.ref, c.y, 9, { bold: true }); line(c, c.y - 5, M, A4.w - M, 1, [0, 0, 0]); c.y -= 18; }
function need(c: Ctx, h: number, r: Report, tenant: Tenant) { if (c.y - h < 90) { addPage(c); void tenant; text(c, `${r.patient.firstName} ${r.patient.lastName ?? ""} - Reg. no. ${r.regNo}`, M, c.y - 8, 9, { bold: true }); c.y -= 28; } }
function sign(c: Ctx, tenant: Tenant, i: number, n: number) {
  const s = tenant.branding.signatories ?? []; line(c, 78, M, A4.w - M); s.slice(0, 2).forEach((g, k) => { const right = k === 1; const x = right ? A4.w - M : M; text(c, g.name, x, 62, 9, { bold: true, right }); if (g.qualification) text(c, g.qualification, x, 51, 8, { right, color: [0.3, 0.3, 0.35] }); });
  text(c, `Page ${i} of ${n}`, A4.w / 2 - 25, 51, 8); if (tenant.branding.footerNote) text(c, tenant.branding.footerNote, A4.w / 2 - 120, 38, 7, { color: [0.4, 0.4, 0.45] });
}
void clean;
