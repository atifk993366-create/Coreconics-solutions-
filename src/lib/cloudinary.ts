import { createHash } from "node:crypto";
import { ApiError, type ApiCtx } from "./types";
/** Signed direct-upload params: browser uploads straight to Cloudinary, API secret never leaves the server. */
export function signUpload(ctx: ApiCtx, kind: string) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME, key = process.env.CLOUDINARY_API_KEY, secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) throw new ApiError(501, "Cloudinary is not configured", "not_configured");
  if (!["logo", "signature", "attachment"].includes(kind)) throw new ApiError(400, "kind must be logo | signature | attachment", "validation");
  const timestamp = Math.floor(Date.now() / 1000); const folder = `labsmart/${ctx.tenantId}/${kind}`;
  const toSign = `folder=${folder}&timestamp=${timestamp}`; const signature = createHash("sha1").update(toSign + secret).digest("hex");
  return { cloudName: cloud, apiKey: key, timestamp, folder, signature, uploadUrl: `https://api.cloudinary.com/v1_1/${cloud}/image/upload` };
}
