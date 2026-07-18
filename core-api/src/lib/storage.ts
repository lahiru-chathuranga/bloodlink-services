import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env";
import { logger } from "./logger";

// Cloudflare R2 — Requirements §13. When R2 credentials are absent (local dev
// before the bucket is provisioned), stub with a fake-but-stable URL so
// POST /uploads/avatar remains fully exercisable end-to-end without R2.
// Swapping in real R2 later only touches this file, per ARCHITECTURE.md's lib/
// layering rule — routes/controllers/services never change.
const r2Client =
  env.r2AccountId && env.r2AccessKeyId && env.r2SecretAccessKey
    ? new S3Client({
        region: "auto",
        endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: env.r2AccessKeyId, secretAccessKey: env.r2SecretAccessKey },
      })
    : null;

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<string> {
  const key = `${randomUUID()}-${originalName}`;

  if (!r2Client || !env.r2BucketName) {
    logger.info({ key, mimeType, size: buffer.length }, "[stub storage] R2 not configured — returning placeholder URL");
    return `https://stub-storage.local/${env.r2BucketName ?? "bloodlink"}/${key}`;
  }

  await r2Client.send(
    new PutObjectCommand({
      Bucket: env.r2BucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  // R2 buckets have no public URL by default — a bucket needs either a
  // connected custom domain or the r2.dev public-access toggle enabled in the
  // Cloudflare dashboard before this URL actually resolves. If neither is
  // enabled yet, the upload itself still succeeds; only viewing the image fails.
  return env.r2PublicBaseUrl
    ? `${env.r2PublicBaseUrl.replace(/\/$/, "")}/${key}`
    : `https://${env.r2BucketName}.${env.r2AccountId}.r2.cloudflarestorage.com/${key}`;
}
