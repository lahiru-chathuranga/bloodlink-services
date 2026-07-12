import { randomUUID } from "crypto";
import { env } from "../config/env";
import { logger } from "./logger";

// Cloudflare R2 — Requirements §13. When R2 credentials are absent (local dev
// before the bucket is provisioned), stub with a fake-but-stable URL so
// POST /uploads/avatar remains fully exercisable end-to-end without R2.
// Swapping in real R2 later only touches this file, per ARCHITECTURE.md's lib/
// layering rule — routes/controllers/services never change.
export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<string> {
  const key = `${randomUUID()}-${originalName}`;

  if (!env.r2AccountId || !env.r2AccessKeyId || !env.r2SecretAccessKey || !env.r2BucketName) {
    logger.info({ key, mimeType, size: buffer.length }, "[stub storage] R2 not configured — returning placeholder URL");
    return `https://stub-storage.local/${env.r2BucketName ?? "bloodlink"}/${key}`;
  }

  // Real R2 (S3-compatible) upload would use @aws-sdk/client-s3 here, pointed
  // at `https://${env.r2AccountId}.r2.cloudflarestorage.com`. Not wired yet —
  // credentials weren't available this session; see TASKS.md handoff log.
  throw new Error("R2 credentials present but real upload path not yet implemented.");
}
