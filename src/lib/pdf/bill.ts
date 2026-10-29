import type { Bill, Tenant } from "../types";
import { rupeesInWords } from "../util/words";
import { A4, M, addPage, barcode, fetchLogo, header, line, newDoc, text, type Ctx } from "./common";

export async function billPdf(bill: Bill, tenant: Tenant): Promise<Uint8Array> {
  const { doc, font, bold } = await newDoc(); const page = doc.addPage([A4.w, A4.h]); const c: Ctx = { doc, page, y: A4.h - M, font, bold, pages: [page], logo: await fetchLogo(doc, tenant.branding.logoUrl) };
  await header(c, tenant.branding); const bc = await barcode(doc, String(bill.regNo));
  if (bc) c.page.drawImage(bc, { x: M, y: c.y - 30, width: 90, height: 28 }); c.y -= bc ? 40 : 4; text(c, `Bill / Reg. No. ${bill.regNo}`, M, c.y, 9.5, { bold: true });
  const p = bill.patient; const name = `${p.title ? p.title + " " : ""}${p.firstName} ${p.lastName ?? ""}`.trim(); const mid = A4.w / 2 + 10; let y = c.y - 20;
  const L: [string, string][] = [["Name", name], ["Age / Sex", `${p.ageYears} YRS / ${p.sex}`], ["Mobile number", p.mobile ?? ""], ["Address", p.address ?? ""]];
  const R: [string, string][] = [["Referred by", bill.referrerName], ["Date", bill.date.split("-").reverse().join("/")], ["Received by", bill.createdBy ?? ""]];
  L.forEach(([k, v], i) => { text(c, `${k} :`, M, y - i * 16, 9.5, { bold: true }); text(c, v, M + 78, y - i * 16, 9.5, { maxW: mid - M - 90 }); });
  R.forEach(([k, v], i) => { text(c, `${k} :`, mid, y - i * 16, 9.5, { bold: true }); text(c, v, mid + 68, y - i * 16, 9.5, { maxW: A4.w - M - mid - 70 }); });
  y -= 78; line(c, y + 8, M, A4.w - M, 1, [0, 0, 0]); text(c, "S. NO.", M, y - 6, 9.5); text(c, "INVESTIGATIONS", M + 70, y - 6, 9.5); text(c, "AMOUNT", A4.w - M, y - 6, 9.5, { right: true }); line(c, y - 12, M, A4.w - M, 1, [0, 0, 0]); y -= 28;
  const rs = (n: number) => "Rs." + n.toLocaleString("en-IN");
  bill.items.forEach((it, i) => { text(c, String(i + 1) + ".", M, y, 9.5); text(c, it.name, M + 70, y, 9.5, { maxW: 330 }); text(c, rs(it.price), A4.w - M, y, 9.5, { right: true }); y -= 16; line(c, y + 10); });
  const rows: [string, string][] = [["Total amount", rs(bill.subtotal)]]; if (bill.discountAmount) { rows.push(["Discount", "- " + rs(bill.discountAmount)], ["Net amount", rs(bill.total)]); }
  rows.push(["Amount paid", rs(bill.paid)]); if (bill.balance > 0) rows.push(["Balance due", rs(bill.balance)]);
  for (const [k, v] of rows) { text(c, k, 250, y, 9.5, { bold: k === "Balance due" }); text(c, v, A4.w - M, y, 9.5, { right: true, bold: k === "Balance due" }); y -= 16; line(c, y + 10, 250); }
  text(c, "Amount Paid (in words):", 250, y, 9.5); text(c, rupeesInWords(bill.paid), A4.w - M, y, 9.5, { right: true, maxW: 220 }); y -= 70;
  line(c, y, 300, A4.w - M); text(c, "Cashier's signature", A4.w - M - 40, y - 12, 9.5, { right: true }); y -= 45;
  text(c, "~~~ Thank You ~~~", A4.w / 2, y, 9.5, {}); if (bill.cancelled) text(c, "CANCELLED", A4.w / 2 - 60, A4.h / 2, 40, { bold: true, color: [0.85, 0.2, 0.2] });
  if (tenant.branding.tagline) text(c, tenant.branding.tagline.toUpperCase(), A4.w / 2 - 70, y - 18, 8.5, { color: [0.2, 0.25, 0.4] });
  return doc.save();
}
void addPage;
