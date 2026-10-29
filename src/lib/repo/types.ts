export type Op = "==" | ">=" | "<=" | "in" | "!=";
export interface Query { where?: [string, Op, unknown][]; orderBy?: [string, "asc" | "desc"]; limit?: number }
export interface Repo {
  get<T>(col: string, id: string): Promise<T | null>;
  set<T extends object>(col: string, id: string, doc: T): Promise<void>;
  patch(col: string, id: string, patch: object): Promise<void>;
  del(col: string, id: string): Promise<void>;
  query<T>(col: string, q: Query): Promise<T[]>;
  /** atomic increment — used for bill/reg numbers */
  nextCounter(tenantId: string, name: string, start?: number): Promise<number>;
}
