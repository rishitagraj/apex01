import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const B2_BUCKET = process.env.B2_BUCKET ?? "apex-storage";
const B2_REGION = process.env.B2_REGION ?? "us-west-004";

class B2UnconfiguredError extends Error {
  code = "NOT_CONFIGURED" as const;
  constructor() {
    super("Backblaze B2 credentials are not configured");
  }
}

/** B2's S3-compatible API endpoint (no path prefix needed for S3 dialect). */
function client(): S3Client {
  const applicationKeyId = process.env.B2_APPLICATION_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;
  if (!applicationKeyId || !applicationKey) throw new B2UnconfiguredError();
  return new S3Client({
    region: B2_REGION,
    endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
    credentials: { accessKeyId: applicationKeyId, secretAccessKey: applicationKey },
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
      Bucket: B2_BUCKET,
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
    new GetObjectCommand({ Bucket: B2_BUCKET, Key: key }),
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
  await s3.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: key }));
}