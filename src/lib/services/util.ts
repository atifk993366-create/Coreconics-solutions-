import { ApiError, type ApiCtx } from "../types";
export const nowIso = () => new Date().toISOString();
export function dateInTz(d: Date | string = new Date(), tz = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(typeof d === "string" ? new Date(d) : d);
}
export const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function need<T>(v: T | null | undefined, what = "Resource"): T { if (v === null || v === undefined) throw new ApiError(404, `${what} not found`, "not_found"); return v; }
export function str(v: unknown, field: string, { max = 200, required = true }: { max?: number; required?: boolean } = {}): string {
  if (v === undefined || v === null || v === "") { if (required) throw new ApiError(400, `${field} is required`, "validation"); return ""; }
  if (typeof v !== "string") throw new ApiError(400, `${field} must be a string`, "validation");
  if (v.length > max) throw new ApiError(400, `${field} too long`, "validation"); return v.trim();
}
export function numv(v: unknown, field: string, { min = 0, max = 1e9, required = true }: { min?: number; max?: number; required?: boolean } = {}): number {
  if (v === undefined || v === null || v === "") { if (required) throw new ApiError(400, `${field} is required`, "validation"); return 0; }
  const n = Number(v); if (!isFinite(n) || n < min || n > max) throw new ApiError(400, `${field} is invalid`, "validation"); return n;
}
export function requireRole(ctx: ApiCtx, ...roles: ApiCtx["role"][]) { if (!roles.includes(ctx.role)) throw new ApiError(403, "Not allowed for this credential", "forbidden"); }
export const inRange = (d: string, from?: string, to?: string) => (!from || d >= from) && (!to || d <= to);

import { getRepo } from "../repo";
import type { Op } from "../repo/types";
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = []; const d = new Date(from + "T00:00:00Z"); const end = new Date(to + "T00:00:00Z");
  if (isNaN(+d) || isNaN(+end) || d > end) return out; for (let i = 0; d <= end && i < 400; i++, d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10)); return out;
}
/** Reads docs of a tenant whose `date` (YYYY-MM-DD) is within [from,to]. Uses one equality query per day (<=120 days) so Firestore reads
 *  only what is needed; wider/open ranges fall back to a tenant-wide read filtered in memory. */
export async function byDateRange<T extends { date?: string }>(col: string, tid: string, from?: string, to?: string, extra: [string, Op, unknown][] = []): Promise<T[]> {
  const repo = getRepo();
  if (from && to) { const days = daysBetween(from, to); if (days.length && days.length <= 120) { const out: T[] = []; for (let i = 0; i < days.length; i += 15) out.push(...(await Promise.all(days.slice(i, i + 15).map(d => repo.query<T>(col, { where: [["tenantId", "==", tid], ["date", "==", d], ...extra] })))).flat()); return out; } }
  const rows = await repo.query<T>(col, { where: [["tenantId", "==", tid], ...extra] }); return rows.filter(r => inRange(r.date ?? "", from, to));
}
