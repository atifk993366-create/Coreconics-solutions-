import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newId = (prefix = "") => prefix + randomBytes(10).toString("hex");
export function newApiKey() { const secret = "lsk_live_" + randomBytes(24).toString("base64url"); return { secret, hash: sha256(secret), last4: secret.slice(-4) }; }
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function signJwt(claims: Record<string, unknown>, secret: string, ttlSec = 3600): string {
  const h = b64({ alg: "HS256", typ: "JWT" }); const now = Math.floor(Date.now() / 1000);
  const p = b64({ iat: now, exp: now + ttlSec, ...claims }); const sig = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${sig}`;
}
export function verifyJwt<T = any>(token: string, secret: string): T | null {
  const [h, p, s] = token.split("."); if (!h || !p || !s) return null;
  const exp = createHmac("sha256", secret).update(`${h}.${p}`).digest(); let got: Buffer; try { got = Buffer.from(s, "base64url"); } catch { return null; }
  if (got.length !== exp.length || !timingSafeEqual(got, exp)) return null;
  try { const c = JSON.parse(Buffer.from(p, "base64url").toString()); if (c.exp && c.exp < Math.floor(Date.now() / 1000)) return null; return c; } catch { return null; }
}
