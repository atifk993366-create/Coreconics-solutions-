import type { Repo, Query } from "./types";
export class MemoryRepo implements Repo {
  data = new Map<string, Map<string, any>>(); counters = new Map<string, number>();
  private c(col: string) { let m = this.data.get(col); if (!m) this.data.set(col, (m = new Map())); return m; }
  async get<T>(col: string, id: string) { const v = this.c(col).get(id); return v ? (structuredClone(v) as T) : null; }
  async set<T extends object>(col: string, id: string, doc: T) { this.c(col).set(id, structuredClone({ ...doc })); }
  async patch(col: string, id: string, patch: object) { const m = this.c(col); const v = m.get(id); if (!v) throw new Error("not found"); m.set(id, { ...v, ...structuredClone(patch) }); }
  async del(col: string, id: string) { this.c(col).delete(id); }
  async query<T>(col: string, q: Query) {
    let rows = [...this.c(col).values()];
    for (const [f, op, val] of q.where ?? []) rows = rows.filter(r => { const v = r[f]; switch (op) { case "==": return v === val; case "!=": return v !== val; case ">=": return v >= (val as any); case "<=": return v <= (val as any); case "in": return (val as unknown[]).includes(v); } });
    if (q.orderBy) { const [f, d] = q.orderBy; rows.sort((a, b) => (a[f] > b[f] ? 1 : a[f] < b[f] ? -1 : 0) * (d === "desc" ? -1 : 1)); }
    if (q.limit) rows = rows.slice(0, q.limit);
    return structuredClone(rows) as T[];
  }
  async nextCounter(tenantId: string, name: string, start = 1000) { const k = `${tenantId}:${name}`; const n = (this.counters.get(k) ?? start - 1) + 1; this.counters.set(k, n); return n; }
}
