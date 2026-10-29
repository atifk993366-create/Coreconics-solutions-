import type { Repo } from "./types"; import { MemoryRepo } from "./memory"; import { FirestoreRepo } from "./firestore";
const g = globalThis as any;
export function getRepo(): Repo {
  if (g.__repo) return g.__repo;
  const useFs = !!(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_PRIVATE_KEY);
  if (!useFs && process.env.NODE_ENV === "production") throw new Error("Firebase credentials missing (FIREBASE_SERVICE_ACCOUNT)");
  return (g.__repo = useFs ? new FirestoreRepo() : new MemoryRepo());
}
export const setRepo = (r: Repo) => { g.__repo = r; };
