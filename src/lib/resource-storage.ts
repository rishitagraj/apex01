import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  RESOURCE_DBBYTE_BLOCKED_MIMES,
  RESOURCE_UPLOAD_MAX_BYTES,
  RESOURCE_UPLOAD_MIMES,
  RESOURCE_UPLOAD_TYPE_LABEL,
  RESOURCE_UPLOAD_TYPE_LABEL_DBBYTE,
  type ResourceUploadMime,
} from "@/lib/resources";

type ResourceStorageProvider = "dbbyte" | "b2";

/**
 * Personal document storage. DBByte is used when its credentials are present,
 * otherwise the app falls back to the Backblaze B2 resources bucket.
 */
export const RESOURCE_STORAGE_PROVIDER: ResourceStorageProvider =
  (
    process.env.RESOURCE_STORAGE ??
    (process.env.DBBYTE_ACCESS_KEY_ID ? "dbbyte" : "b2")
  ).toLowerCase() === "dbbyte"
    ? "dbbyte"
    : "b2";

const B2_REGION = process.env.B2_REGION ?? "us-west-004";

export const RESOURCES_BUCKET =
  RESOURCE_STORAGE_PROVIDER === "dbbyte"
    ? process.env.DBBYTE_BUCKET ?? "my-first-bucket"
    : process.env.B2_RESOURCES_BUCKET ?? "dbbytes";

/** DBByte cannot receive browser PUTs (no CORS), so uploads are relayed in parts. */
export const RESOURCE_UPLOAD_MODE: "direct" | "relay" =
  RESOURCE_STORAGE_PROVIDER === "dbbyte" ? "relay" : "direct";

/** MIME types the active storage provider can actually keep. */
export const RESOURCE_ALLOWED_MIMES: readonly ResourceUploadMime[] =
  RESOURCE_STORAGE_PROVIDER === "dbbyte"
    ? RESOURCE_UPLOAD_MIMES.filter(
        (mime) => !RESOURCE_DBBYTE_BLOCKED_MIMES.includes(mime),
      )
    : RESOURCE_UPLOAD_MIMES;

export const RESOURCE_STORAGE_TYPE_LABEL =
  RESOURCE_STORAGE_PROVIDER === "dbbyte"
    ? RESOURCE_UPLOAD_TYPE_LABEL_DBBYTE
    : RESOURCE_UPLOAD_TYPE_LABEL;

class ResourceStorageUnconfiguredError extends Error {
  code = "NOT_CONFIGURED" as const;
  constructor() {
    super("Resource document storage is not configured");
  }
}

function resourceClient(): S3Client {
  if (RESOURCE_STORAGE_PROVIDER === "dbbyte") {
    const accessKeyId = process.env.DBBYTE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.DBBYTE_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) {
      throw new ResourceStorageUnconfiguredError();
    }
    return new S3Client({
      region: process.env.DBBYTE_REGION ?? "auto",
      endpoint: process.env.DBBYTE_ENDPOINT ?? "https://s3.dbbyte.com",
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  const accessKeyId = process.env.B2_APPLICATION_KEY_ID;
  const secretAccessKey = process.env.B2_APPLICATION_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new ResourceStorageUnconfiguredError();
  }
  return new S3Client({
    region: B2_REGION,
    endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export const RESOURCE_FILES_PREFIX = "resources/";

export function resourceOwnerPrefix(userId: string): string {
  return `${RESOURCE_FILES_PREFIX}${userId.replace(/[^a-zA-Z0-9]/g, "")}/`;
}

/** Guards against completing or deleting another user's object. */
export function isResourceFileKeyOwnedBy(
  fileKey: string,
  userId: string,
): boolean {
  return (
    fileKey.startsWith(resourceOwnerPrefix(userId)) &&
    !fileKey.includes("..") &&
    !fileKey.includes("\\")
  );
}

/** Per-user key for an uploaded resource document. */
export function newResourceFileKey(userId: string, originalName: string): string {
  const owner = userId.replace(/[^a-zA-Z0-9]/g, "");
  const trimmed = originalName.trim().slice(0, 140);
  const dot = trimmed.lastIndexOf(".");
  const rawBase = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  const base =
    rawBase
      .replace(/[^a-z0-9._-]/gi, "_")
      .replace(/_+/g, "_")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 60) || "document";
  const ext =
    dot > 0
      ? trimmed
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 10)
      : "";
  const nonce = crypto.randomUUID().slice(0, 8);
  return `${RESOURCE_FILES_PREFIX}${owner}/${Date.now()}-${nonce}-${base}${ext ? `.${ext}` : ""}`;
}

/** Total bytes currently stored under a prefix (pagination-aware). */
export async function listResourceObjectsSize(prefix: string): Promise<number> {
  const s3 = resourceClient();
  let total = 0;
  let token: string | undefined;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: RESOURCES_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const obj of res.Contents ?? []) {
      total += obj.Size ?? 0;
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return total;
}

/** Presigned PUT the browser uses to upload directly into the bucket. */
export async function presignResourceUpload(
  key: string,
  contentType: string,
  fileSize: number,
): Promise<string> {
  if (fileSize > RESOURCE_UPLOAD_MAX_BYTES) {
    throw new Error("File exceeds the 25 MB limit");
  }
  const s3 = resourceClient();
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: RESOURCES_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 3600 },
  );
}

/** Creates a multipart upload the browser feeds through the relay routes. */
export async function createResourceMultipartUpload(
  key: string,
  contentType: string,
): Promise<string> {
  const s3 = resourceClient();
  const res = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: RESOURCES_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
  );
  if (!res.UploadId) throw new Error("Storage did not return an upload id");
  return res.UploadId;
}

/** Uploads one part (max 4 MiB) of a relayed document. */
export async function uploadResourcePart(
  key: string,
  uploadId: string,
  partNumber: number,
  body: Uint8Array,
): Promise<string> {
  const s3 = resourceClient();
  const res = await s3.send(
    new UploadPartCommand({
      Bucket: RESOURCES_BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body,
      ContentLength: body.byteLength,
    }),
  );
  if (!res.ETag) throw new Error("Storage did not return a part ETag");
  return res.ETag;
}

export async function completeResourceMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>,
): Promise<void> {
  const s3 = resourceClient();
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: RESOURCES_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((part) => ({
          PartNumber: part.partNumber,
          ETag: part.etag,
        })),
      },
    }),
  );
}

export async function abortResourceMultipartUpload(
  key: string,
  uploadId: string,
): Promise<void> {
  const s3 = resourceClient();
  await s3.send(
    new AbortMultipartUploadCommand({
      Bucket: RESOURCES_BUCKET,
      Key: key,
      UploadId: uploadId,
    }),
  );
}

/** Object metadata for an uploaded resource document. */
export async function headResourceObject(
  key: string,
): Promise<{ size: number; contentType: string }> {
  const s3 = resourceClient();
  const res = await s3.send(
    new HeadObjectCommand({ Bucket: RESOURCES_BUCKET, Key: key }),
  );
  return {
    size: res.ContentLength ?? 0,
    contentType: res.ContentType ?? "",
  };
}

function contentDisposition(fileName: string, download: boolean): string {
  const cleaned = fileName.replace(/[\r\n]/g, " ").trim() || "document";
  const fallback = cleaned.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(cleaned).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * Short-lived signed GET. Resource downloads are redirected here so large
 * documents never pass through a Vercel function response.
 */
export async function presignResourceDownload(
  key: string,
  options: { fileName: string; contentType: string; download?: boolean },
): Promise<string> {
  const s3 = resourceClient();
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: RESOURCES_BUCKET,
      Key: key,
      ResponseContentType: options.contentType || "application/octet-stream",
      // DBByte's S3 gateway ignores response overrides; the client falls back
      // to a blob download so the original filename is preserved.
      ...(RESOURCE_STORAGE_PROVIDER === "b2"
        ? {
            ResponseContentDisposition: contentDisposition(
              options.fileName,
              options.download ?? false,
            ),
          }
        : {}),
    }),
    { expiresIn: 600 },
  );
}

export async function deleteResourceObject(key: string): Promise<void> {
  const s3 = resourceClient();
  await s3.send(
    new DeleteObjectCommand({ Bucket: RESOURCES_BUCKET, Key: key }),
  );
}
