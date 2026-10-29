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
    let ref: any = (await db()).collection(col);
    for (const [f, op, v] of q.where ?? []) ref = ref.where(f, op, v);
    if (q.orderBy) ref = ref.orderBy(q.orderBy[0], q.orderBy[1]);
    if (q.limit) ref = ref.limit(q.limit);
    return (await ref.get()).docs.map((d: any) => d.data() as T);
  }
  async nextCounter(tenantId: string, name: string, start = 1000) {
    const d = await db(); const ref = d.collection("counters").doc(`${tenantId}_${name}`);
    return d.runTransaction(async (t: any) => { const s = await t.get(ref); const n = (s.exists ? s.data().value : start - 1) + 1; t.set(ref, { value: n, tenantId }); return n; });
  }
}
