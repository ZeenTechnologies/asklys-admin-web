// Object storage (MinIO / S3). Writes only — the bucket is publicly readable.
import "server-only";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "./env";

const g = globalThis as unknown as { _s3?: S3Client };

export const s3 =
  g._s3 ??
  new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    // Required for MinIO: it addresses endpoint/bucket/key, AWS uses bucket.endpoint/key.
    forcePathStyle: true,
  });

if (!env.isProd) g._s3 = s3;

// Built in one place, so moving to a CDN is an env change plus one UPDATE over media.path.
export const publicUrl = (key: string): string => `${env.S3_PUBLIC_URL}/${key}`;

// 2026/1755600000000-my-photo.jpg — timestamped so a re-upload never overwrites a published image.
export function objectKey(filename: string): string {
  const ext = (filename.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const stem = filename
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "image";
  return `${new Date().getFullYear()}/${Date.now()}-${stem}.${ext}`;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.byteLength,
      // Keys are timestamped, so bytes never change for a given key.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}
