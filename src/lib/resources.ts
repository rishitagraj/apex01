import type { ResourceKind } from "@/types/syllabus";

export type ResourceItemRow = {
  id: string;
  folderId: string | null;
  kind: ResourceKind;
  title: string;
  url: string;
  notes: string | null;
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
};

/** A library entry: an item plus who owns it, for the shared browse view. */
export type ResourceLibraryItemRow = ResourceItemRow & {
  ownerName: string;
  isOwner: boolean;
};

export type ResourceFolderRow = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  itemCount?: number;
};

export const RESOURCE_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
export const RESOURCE_UPLOAD_MAX_FILES = 10;
export const RESOURCE_STORAGE_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;
export const RESOURCE_FILE_ROUTE_PREFIX = "/api/resources/files/";
/** Public, sign-in-free route for an uploaded document. */
export const RESOURCE_PUBLIC_FILE_ROUTE_PREFIX = "/api/resources/public/";

const UPLOAD_MIME_KINDS = {
  "application/pdf": "PDF",
  "image/png": "IMAGE",
  "image/jpeg": "IMAGE",
  "image/webp": "IMAGE",
  "image/gif": "IMAGE",
  "image/avif": "IMAGE",
  "application/msword": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCUMENT",
  "application/vnd.ms-powerpoint": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "DOCUMENT",
  "application/vnd.ms-excel": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "DOCUMENT",
  "text/plain": "DOCUMENT",
  "text/markdown": "DOCUMENT",
  "text/csv": "DOCUMENT",
  "application/rtf": "DOCUMENT",
  "text/rtf": "DOCUMENT",
  "application/vnd.oasis.opendocument.text": "DOCUMENT",
  "application/vnd.oasis.opendocument.spreadsheet": "DOCUMENT",
  "application/vnd.oasis.opendocument.presentation": "DOCUMENT",
  "application/epub+zip": "DOCUMENT",
} as const satisfies Record<string, ResourceKind>;

export type ResourceUploadMime = keyof typeof UPLOAD_MIME_KINDS;

/** Every file type the Resources tab can accept. */
export const RESOURCE_UPLOAD_MIMES = Object.keys(
  UPLOAD_MIME_KINDS,
) as ResourceUploadMime[];

/**
 * DBByte's S3 gateway refuses these MIME types (`UnsupportedMediaType`), so
 * they can only be stored on the B2 provider.
 */
export const RESOURCE_DBBYTE_BLOCKED_MIMES: readonly ResourceUploadMime[] = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/rtf",
  "text/rtf",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/epub+zip",
];

/**
 * Browser uploads go through Vercel, which caps request bodies at 4.5 MB.
 * Keeping parts at 4 MiB leaves room for headers; DBByte accepts parts below
 * the S3 5 MiB minimum.
 */
export const RESOURCE_UPLOAD_PART_SIZE = 4 * 1024 * 1024;

const EXTENSION_MIME: Record<string, ResourceUploadMime> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  rtf: "application/rtf",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  epub: "application/epub+zip",
};

export const RESOURCE_UPLOAD_ACCEPT = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".rtf",
  ".odt",
  ".ods",
  ".odp",
  ".epub",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".avif",
].join(",");

export const RESOURCE_UPLOAD_TYPE_LABEL =
  "PDF, Word, PowerPoint, Excel, text, Markdown, CSV, OpenDocument, EPUB or images";
export const RESOURCE_UPLOAD_TYPE_LABEL_DBBYTE =
  "PDF, Word, text, Markdown, CSV or images";

/** `accept` attribute for the file picker, limited to the given MIME types. */
export function resourceUploadAccept(mimeTypes: readonly string[]): string {
  const allowed = new Set(mimeTypes);
  return Object.entries(EXTENSION_MIME)
    .filter(([, mime]) => allowed.has(mime))
    .map(([ext]) => `.${ext}`)
    .join(",");
}

/** Resolve the MIME type we store, falling back to the file extension. */
export function normalizeUploadContentType(
  fileName: string,
  contentType?: string | null,
  allowed?: readonly string[],
): ResourceUploadMime | null {
  const allowedSet = allowed ? new Set(allowed) : null;
  const declared = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (declared && declared in UPLOAD_MIME_KINDS) {
    if (allowedSet && !allowedSet.has(declared)) return null;
    return declared as ResourceUploadMime;
  }
  const ext = fileName.split(".").pop()?.trim().toLowerCase();
  if (!ext) return null;
  const fromExt = EXTENSION_MIME[ext];
  if (!fromExt) return null;
  if (allowedSet && !allowedSet.has(fromExt)) return null;
  return fromExt;
}

export function resourceKindForMime(mime: string): ResourceKind {
  return (UPLOAD_MIME_KINDS as Record<string, ResourceKind>)[mime] ?? "DOCUMENT";
}

export function resourceFileUrl(fileKey: string): string {
  return (
    RESOURCE_FILE_ROUTE_PREFIX +
    encodeResourceKeyPath(fileKey)
  );
}

/**
 * Stable public link for an uploaded document. The route resolves the stored
 * item and redirects to a short-lived signed GET, so deleting the item removes
 * public access immediately.
 */
export function resourcePublicFileUrl(fileKey: string): string {
  return RESOURCE_PUBLIC_FILE_ROUTE_PREFIX + encodeResourceKeyPath(fileKey);
}

function encodeResourceKeyPath(fileKey: string): string {
  return fileKey
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function resourceFileKeyFromUrl(url: string): string | null {
  let path = url.trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      return null;
    }
  } else {
    path = path.split("#")[0].split("?")[0];
  }
  const prefix = path.startsWith(RESOURCE_FILE_ROUTE_PREFIX)
    ? RESOURCE_FILE_ROUTE_PREFIX
    : path.startsWith(RESOURCE_PUBLIC_FILE_ROUTE_PREFIX)
      ? RESOURCE_PUBLIC_FILE_ROUTE_PREFIX
      : null;
  if (!prefix) return null;
  const encoded = path.slice(prefix.length);
  if (!encoded) return null;
  try {
    return encoded
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return null;
  }
}

export function isResourceFileUrl(url: string): boolean {
  return resourceFileKeyFromUrl(url) !== null;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp|heic)(\?|#|$)/i;

export function detectResourceKind(url: string): ResourceKind {
  let href = url.trim();
  if (!href) return "LINK";
  if (!/^https?:\/\//i.test(href)) href = `https://${href}`;

  let host = "";
  try {
    host = new URL(href).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "LINK";
  }

  if (host === "youtu.be" || host.endsWith("youtube.com")) return "YOUTUBE";
  if (/\.pdf(\?|#|$)/i.test(href)) return "PDF";
  if (imageExtensions(host, href)) return "IMAGE";
  return "LINK";
}

function imageExtensions(host: string, href: string): boolean {
  if (IMAGE_EXT.test(href)) return true;
  return (
    host.includes("images.") ||
    host.includes("img.") ||
    host.endsWith("i.imgur.com") ||
    host.endsWith("pinimg.com")
  );
}

export function hostnameOf(url: string): string {
  if (isResourceFileUrl(url)) return "Apex storage";
  try {
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const RESOURCE_KIND_META: Record<
  ResourceKind,
  { label: string; color: string }
> = {
  PDF: { label: "PDF", color: "text-rose-400" },
  IMAGE: { label: "Image", color: "text-sky-400" },
  MARKDOWN: { label: "Notes", color: "text-violet-400" },
  FORMULA: { label: "Formula", color: "text-amber-400" },
  DPP: { label: "DPP", color: "text-emerald-400" },
  PYQ: { label: "PYQ", color: "text-cyan-400" },
  LINK: { label: "Link", color: "text-muted" },
  YOUTUBE: { label: "Video", color: "text-red-400" },
  DOCUMENT: { label: "Document", color: "text-indigo-400" },
};
