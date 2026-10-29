// Firestore implementation (firebase-admin). Loaded lazily so tests/dev work without credentials.
import type { Repo, Query } from "./types";
let _db: any;
export async function adminApp() {
  const admin = await import("firebase-admin");
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT; // JSON string (recommended on Vercel)
    const cred = raw ? JSON.parse(raw) : { projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") };
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
  return admin;
}
async function db() { if (!_db) { const a = await adminApp(); _db = a.firestore(); _db.settings({ ignoreUndefinedProperties: true }); } return _db; }
const clean = (o: any) => JSON.parse(JSON.stringify(o));
export class FirestoreRepo implements Repo {
  async get<T>(col: string, id: string) { const s = await (await db()).collection(col).doc(id).get(); return s.exists ? (s.data() as T) : null; }
  async set<T extends object>(col: string, id: string, doc: T) { await (await db()).collection(col).doc(id).set(clean(doc)); }
  async patch(col: string, id: string, patch: object) { await (await db()).collection(col).doc(id).update(clean(patch)); }
  async del(col: string, id: string) { await (await db()).collection(col).doc(id).delete(); }
  async query<T>(col: string, q: Query) {
<<<<<<< HEAD
    let ref: any = (await db()).collection(col);
    for (const [f, op, v] of q.where ?? []) ref = ref.where(f, op, v);
    if (q.orderBy) ref = ref.orderBy(q.orderBy[0], q.orderBy[1]);
    if (q.limit) ref = ref.limit(q.limit);
    return (await ref.get()).docs.map((d: any) => d.data() as T);
=======
    // Only equality filters go to Firestore (works with the automatic single-field indexes → NO composite index setup).
    // Range filters / ordering / limit are applied here in memory.
    let ref: any = (await db()).collection(col); const rest: [string, string, unknown][] = [];
    for (const [f, op, v] of q.where ?? []) { if (op === "==" || op === "in") ref = ref.where(f, op, v); else rest.push([f, op, v]); }
    let rows: any[] = (await ref.get()).docs.map((d: any) => d.data());
    for (const [f, op, v] of rest) rows = rows.filter(r => (op === ">=" ? r[f] >= (v as any) : op === "<=" ? r[f] <= (v as any) : r[f] !== v));
    if (q.orderBy) { const [f, d] = q.orderBy; rows.sort((a, b) => (a[f] > b[f] ? 1 : a[f] < b[f] ? -1 : 0) * (d === "desc" ? -1 : 1)); }
    return (q.limit ? rows.slice(0, q.limit) : rows) as T[];
>>>>>>> ea8dfb41dbaa7fd42ed7adf7a501661796fa8fdd
  }
  async nextCounter(tenantId: string, name: string, start = 1000) {
    const d = await db(); const ref = d.collection("counters").doc(`${tenantId}_${name}`);
    return d.runTransaction(async (t: any) => { const s = await t.get(ref); const n = (s.exists ? s.data().value : start - 1) + 1; t.set(ref, { value: n, tenantId }); return n; });
  }
}
