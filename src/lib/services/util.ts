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
