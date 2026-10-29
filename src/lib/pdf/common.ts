import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import type { Branding } from "../types";
export const A4 = { w: 595.28, h: 841.89 }; export const M = 36;
const WIN = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split("")); // chars WinAnsi can encode beyond Latin-1
export function clean(s: unknown): string {
  return String(s ?? "").replace(/[μ]/g, "µ").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/→/g, "->").replace(/[\u2010-\u2012]/g, "-").replace(/\u00A0/g, " ").replace(/[^\x20-\x7E\u00A1-\u00FF]/g, c => (WIN.has(c) ? c : "")).replace(/[\r\t]/g, " ");
}
export interface Ctx { doc: PDFDocument; page: PDFPage; y: number; font: PDFFont; bold: PDFFont; logo?: PDFImage | null; pages: PDFPage[] }
export async function newDoc() { const doc = await PDFDocument.create(); const font = await doc.embedFont(StandardFonts.Helvetica); const bold = await doc.embedFont(StandardFonts.HelveticaBold); return { doc, font, bold }; }
export async function fetchLogo(doc: PDFDocument, url?: string): Promise<PDFImage | null> {
  if (!url) return null; try {
    const u = new URL(url); if (u.protocol !== "https:" || !/(^|\.)cloudinary\.com$/.test(u.hostname)) return null; // SSRF guard: Cloudinary only
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000); const r = await fetch(url, { signal: ctl.signal }); clearTimeout(t); if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer()); if (buf.length > 2_000_000) return null; const ct = r.headers.get("content-type") ?? "";
    return ct.includes("png") ? await doc.embedPng(buf) : await doc.embedJpg(buf);
  } catch { return null; }
}
export async function barcode(doc: PDFDocument, text: string): Promise<PDFImage | null> {
  try { // @ts-ignore optional dependency
    const bwip: any = await import("bwip-js"); const png: Uint8Array = await (bwip.default ?? bwip).toBuffer({ bcid: "code128", text, scale: 2, height: 8, includetext: false }); return await doc.embedPng(png);
  } catch { return null; }
}
export function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = []; for (const para of clean(text).split("\n")) { let line = ""; for (const w of para.split(" ")) { const t = line ? line + " " + w : w; if (font.widthOfTextAtSize(t, size) > maxW && line) { out.push(line); line = w; } else line = t; } out.push(line); } return out;
}
export function text(c: Ctx, s: string, x: number, y: number, size = 9, opts: { bold?: boolean; color?: [number, number, number]; right?: boolean; maxW?: number } = {}) {
  const f = opts.bold ? c.bold : c.font; let t = clean(s); if (opts.maxW) while (t.length > 1 && f.widthOfTextAtSize(t, size) > opts.maxW) t = t.slice(0, -1);
  const w = f.widthOfTextAtSize(t, size); c.page.drawText(t, { x: opts.right ? x - w : x, y, size, font: f, color: rgb(...(opts.color ?? [0.1, 0.1, 0.12])) });
}
export function line(c: Ctx, y: number, x1 = M, x2 = A4.w - M, th = 0.6, color: [number, number, number] = [0.75, 0.78, 0.82]) { c.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: th, color: rgb(...color) }); }
export async function header(c: Ctx, b: Branding) {
  text(c, b.labName, M, A4.h - M - 14, 16, { bold: true }); let y = A4.h - M - 30;
  for (const l of [b.address, b.phone ? `Phone no.: ${b.phone}` : "", b.email, b.gstin ? `GSTIN: ${b.gstin}` : ""].filter(Boolean) as string[]) { text(c, l, M, y, 9, { color: [0.3, 0.3, 0.35] }); y -= 11; }
  if (c.logo) { const h = 48, w = Math.min((c.logo.width / c.logo.height) * h, 170); c.page.drawImage(c.logo, { x: A4.w - M - w, y: A4.h - M - h + 6, width: w, height: h }); }
  const by = Math.min(y, A4.h - M - 58) - 2; line(c, by, M, A4.w - M, 0.8); c.y = by - 12;
}
export function addPage(c: Ctx) { c.page = c.doc.addPage([A4.w, A4.h]); c.pages.push(c.page); c.y = A4.h - M; }
