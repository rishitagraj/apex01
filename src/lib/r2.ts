import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const R2_BUCKET = process.env.R2_BUCKET ?? "apex-storage";

class R2UnconfiguredError extends Error {
  code = "NOT_CONFIGURED" as const;
  constructor() {
    super("R2 credentials are not configured");
  }
}

function client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) throw new R2UnconfiguredError();
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function newFileKey(originalName: string): string {
  const slug = originalName.replace(/[^a-z0-9.-]/gi, "_").slice(0, 80);
  return `syllabus-pdfs/${Date.now()}-${slug}`;
}

/** Presigned PUT the browser uses to upload directly into the bucket. */
export async function presignUpload(
  key: string,
  contentType: string,
  fileSize: number,
): Promise<string> {
  if (fileSize > 100 * 1024 * 1024) {
    throw new Error("File exceeds the 100 MB limit");
  }
  const s3 = client();
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 3600 },
  );
}

/** Downloads an object as a Buffer for parsing. */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const s3 = client();
  const res = await s3.send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
  );
  const body = res.Body;
  if (!body) throw new Error("Empty object");
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string): Promise<void> {
  const s3 = client();
  await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}