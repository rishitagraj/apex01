"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  ExternalLink,
  Folder,
  FolderPlus,
  Layers,
  Inbox,
  FileText,
  Image as ImageIcon,
  Link2,
  MonitorPlay,
  Sigma,
  ClipboardList,
  BookOpen,
  Loader2,
  X,
  Check,
  Upload,
  Download,
  File,
  FileUp,
  HardDrive,
  Copy,
  Globe2,
  UserRound,
} from "lucide-react";
import { Button, Input, Label, Card, EmptyState, Badge } from "@/components/ui";
import { RESOURCE_KINDS, type ResourceKind } from "@/types/syllabus";
import {
  isResourceFileUrl,
  normalizeUploadContentType,
  resourceFileKeyFromUrl,
  resourcePublicFileUrl,
  resourceUploadAccept,
  RESOURCE_KIND_META,
  RESOURCE_UPLOAD_MAX_BYTES,
  RESOURCE_UPLOAD_MAX_FILES,
  RESOURCE_UPLOAD_PART_SIZE,
  detectResourceKind,
  hostnameOf,
  type ResourceFolderRow,
  type ResourceItemRow,
  type ResourceLibraryItemRow,
  type ResourceUploadMime,
} from "@/lib/resources";
import { formatBytes } from "@/utils/bytes";

const LINK_KINDS = RESOURCE_KINDS.filter((kind) => kind !== "DOCUMENT");

const UPLOAD_CONCURRENCY = 3;

function KindIcon({ kind, size = 16 }: { kind: ResourceKind; size?: number }) {
  switch (kind) {
    case "PDF":
      return <FileText size={size} />;
    case "IMAGE":
      return <ImageIcon size={size} />;
    case "YOUTUBE":
      return <MonitorPlay size={size} />;
    case "FORMULA":
      return <Sigma size={size} />;
    case "DPP":
      return <ClipboardList size={size} />;
    case "PYQ":
      return <BookOpen size={size} />;
    case "MARKDOWN":
      return <FileText size={size} />;
    case "DOCUMENT":
      return <File size={size} />;
    default:
      return <Link2 size={size} />;
  }
}

type UploadStatus = "queued" | "uploading" | "done" | "error";

type UploadEntry = {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
};

function errorMessage(data: unknown, fallback: string): string {
  const error = (data as { error?: unknown } | null)?.error;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    for (const value of Object.values(error as Record<string, unknown>)) {
      const values = Array.isArray(value) ? value : [value];
      const first = values.find(
        (entry) => typeof entry === "string" && entry.trim(),
      );
      if (typeof first === "string") return first;
    }
  }
  return fallback;
}

function storageErrorMessage(text: string): string {
  const match = text.match(/<Message>([^<]+)<\/Message>/i);
  return match
    ? match[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim()
    : "";
}

function putFile(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      const message = storageErrorMessage(xhr.responseText ?? "");
      reject(new Error(message || `Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () =>
      reject(new Error("Upload failed. Check your connection and try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(file);
  });
}

/** Sends one 4 MiB slice to the relay route and returns the stored part ETag. */
function putPart(
  url: string,
  chunk: Blob,
  onProgress: (loaded: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded);
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(storageErrorMessage(xhr.responseText ?? "") || `Upload failed (${xhr.status}).`));
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText || "{}") as { etag?: unknown };
        if (typeof data.etag !== "string" || !data.etag) {
          throw new Error("missing part etag");
        }
        resolve(data.etag);
      } catch {
        reject(new Error("Could not finish that upload. Please try again."));
      }
    };
    xhr.onerror = () =>
      reject(new Error("Upload failed. Check your connection and try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(chunk);
  });
}

type UploadStart = {
  mode?: "direct" | "relay";
  uploadUrl?: string;
  uploadId?: string;
  fileKey?: string;
  contentType?: string;
  partSize?: number;
};

function fileKeyForItem(item: ResourceItemRow): string | null {
  if (item.fileKey) return item.fileKey;
  return resourceFileKeyFromUrl(item.url);
}

function isStoredItem(item: ResourceItemRow): boolean {
  return Boolean(fileKeyForItem(item)) || isResourceFileUrl(item.url);
}

/** Uploaded files open through the public route or PDF viewer; saved links keep their URL. */
function openHrefForItem(item: ResourceItemRow): string {
  const key = fileKeyForItem(item);
  const href = key ? resourcePublicFileUrl(key) : item.url;
  // Open PDFs in our built-in PDF viewer with annotations
  if (item.kind === 'PDF' || item.fileName?.toLowerCase().endsWith('.pdf') || href.toLowerCase().includes('.pdf')) {
    const proxiedUrl = `/api/pdf-proxy?url=${encodeURIComponent(href)}`;
    return `/pdf-viewer?url=${encodeURIComponent(proxiedUrl)}&name=${encodeURIComponent(item.fileName || item.title)}`;
  }
  return href;
}

/** Wrap a just-created item so it can join the shared browse library. */
function asOwnLibraryItem(item: ResourceItemRow): ResourceLibraryItemRow {
  return { ...item, ownerName: "", isOwner: true };
}

function ownerLabelOf(item: ResourceLibraryItemRow): string {
  if (item.isOwner) return "You";
  return item.ownerName?.trim() || "A member";
}

function itemMatchesQuery(
  item: ResourceItemRow | ResourceLibraryItemRow,
  query: string,
): boolean {
  if (!query) return true;
  const owner = "ownerName" in item ? item.ownerName : "";
  const hay = `${item.title} ${item.fileName ?? ""} ${item.url} ${item.notes ?? ""} ${owner} ${RESOURCE_KIND_META[item.kind].label} ${hostnameOf(item.url)}`.toLowerCase();
  return hay.includes(query);
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

export function ResourcesLibrary({
  uploadMimes,
  uploadTypeLabel,
}: {
  uploadMimes: readonly ResourceUploadMime[];
  uploadTypeLabel: string;
}) {
  const [folders, setFolders] = useState<ResourceFolderRow[]>([]);
  const [items, setItems] = useState<ResourceItemRow[]>([]);
  // Every public upload from every account, plus the viewer's own saved links.
  const [libraryItems, setLibraryItems] = useState<ResourceLibraryItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [section, setSection] = useState<"manage" | "browse">("manage");

  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [browseOwner, setBrowseOwner] = useState<"all" | "mine">("all");
  const [browseKind, setBrowseKind] = useState<ResourceKind | "ALL">("ALL");

  // folder creation / rename
  const [newFolder, setNewFolder] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);

  // add resource
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ResourceKind>("LINK");
  const [kindTouched, setKindTouched] = useState(false);
  const [folderId, setFolderId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  // upload documents
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [uploadEntries, setUploadEntries] = useState<UploadEntry[]>([]);
  const [uploadFolderId, setUploadFolderId] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/resources")
      .then((r) => r.json())
      .then((data) => {
        setFolders((data.folders ?? []) as ResourceFolderRow[]);
        setItems((data.items ?? []) as ResourceItemRow[]);
        setLibraryItems(
          (data.libraryItems ?? []) as ResourceLibraryItemRow[],
        );
      })
      .catch(() => setError("Could not load your resources."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeFolder === "unfiled") setUploadFolderId("");
    else if (activeFolder !== "all") setUploadFolderId(activeFolder);
  }, [activeFolder]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      if (it.folderId) map.set(it.folderId, (map.get(it.folderId) ?? 0) + 1);
    }
    return map;
  }, [items]);
  const unfiledCount = items.filter((i) => !i.folderId).length;
  const publicFileCount = libraryItems.filter(isStoredItem).length;

  const query = search.trim().toLowerCase();

  const manageItems = useMemo(() => {
    if (activeFolder === "unfiled") return items.filter((it) => !it.folderId);
    if (activeFolder === "all") return items;
    return items.filter((it) => it.folderId === activeFolder);
  }, [items, activeFolder]);

  const browseKinds = useMemo(() => {
    const present = new Set(libraryItems.map((it) => it.kind));
    return RESOURCE_KINDS.filter((resourceKind) => present.has(resourceKind));
  }, [libraryItems]);

  const browseItems = useMemo(
    () =>
      libraryItems.filter((it) => {
        if (!itemMatchesQuery(it, query)) return false;
        if (browseKind !== "ALL" && it.kind !== browseKind) return false;
        if (browseOwner === "mine" && !it.isOwner) return false;
        return true;
      }),
    [libraryItems, query, browseKind, browseOwner],
  );

  const activeFolderName =
    activeFolder === "all"
      ? "All resources"
      : activeFolder === "unfiled"
        ? "Unfiled"
        : folders.find((f) => f.id === activeFolder)?.name ?? "Resources";

  const hasBrowseFilters =
    Boolean(query) || browseKind !== "ALL" || browseOwner !== "all";

  function onUrlChange(value: string) {
    setUrl(value);
    if (!kindTouched) setKind(detectResourceKind(value));
  }

  async function createFolder(e: React.FormEvent) {
    e.preventDefault();
    const name = newFolder.trim();
    if (!name) return;
    setCreatingFolder(true);
    setError("");
    const res = await fetch("/api/resources/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const { folder } = await res.json();
      setFolders((prev) => [...prev, folder]);
      setNewFolder("");
      setActiveFolder(folder.id);
    } else {
      setError("Could not create folder.");
    }
    setCreatingFolder(false);
  }

  async function saveRename(id: string) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name) return;
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
    await fetch(`/api/resources/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  async function deleteFolder(id: string) {
    setDeleteFolderId(null);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setItems((prev) => prev.map((it) => (it.folderId === id ? { ...it, folderId: null } : it)));
    setLibraryItems((prev) =>
      prev.map((it) => (it.folderId === id ? { ...it, folderId: null } : it)),
    );
    if (activeFolder === id) setActiveFolder("all");
    await fetch(`/api/resources/folders/${id}`, { method: "DELETE" });
  }

  async function addResource(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    if (!url.trim()) {
      setAddError("Paste a link to save.");
      return;
    }
    setAdding(true);
    const res = await fetch("/api/resources/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url.trim(),
        title: title.trim() || undefined,
        kind,
        folderId: folderId || null,
        notes: notes.trim() || undefined,
      }),
    });
    if (res.ok) {
      const { item } = await res.json();
      setItems((prev) => [item, ...prev]);
      setLibraryItems((prev) => [asOwnLibraryItem(item), ...prev]);
      setUrl("");
      setTitle("");
      setNotes("");
      setKind("LINK");
      setKindTouched(false);
      setActiveFolder(folderId || "all");
      setError("");
    } else {
      const data = await res.json().catch(() => ({}));
      setAddError(
        typeof data.error === "string" ? data.error : "Could not save that link.",
      );
    }
    setAdding(false);
  }

  async function moveItem(item: ResourceItemRow, target: string) {
    const nextFolder = target || null;
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, folderId: nextFolder } : it)),
    );
    setLibraryItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, folderId: nextFolder } : it)),
    );
    await fetch(`/api/resources/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: nextFolder }),
    });
  }

  async function deleteItem(id: string) {
    setBusyId(id);
    setItems((prev) => prev.filter((it) => it.id !== id));
    setLibraryItems((prev) => prev.filter((it) => it.id !== id));
    await fetch(`/api/resources/items/${id}`, { method: "DELETE" });
    setBusyId(null);
  }

  async function downloadItem(item: ResourceItemRow) {
    setDownloadingId(item.id);
    setError("");
    try {
      const key = fileKeyForItem(item);
      let downloadUrl = item.url;
      if (key) {
        downloadUrl = resourcePublicFileUrl(key) + "?download=1";
      } else if (openHrefForItem(item).includes("/api/")) {
        downloadUrl = openHrefForItem(item) + (openHrefForItem(item).includes("?") ? "&" : "?") + "download=1";
      }
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = item.fileName ?? item.title ?? "download";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      console.error(err);
      setError("Could not download that file. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function copyItemLink(item: ResourceItemRow) {
    const href = openHrefForItem(item);
    const absolute = new URL(href, window.location.origin).toString();
    const copied = await copyText(absolute);
    if (!copied) {
      setError("Could not copy that link. Open the resource and copy its URL.");
      return;
    }
    setError("");
    setCopiedId(item.id);
    window.setTimeout(() => {
      setCopiedId((current) => (current === item.id ? null : current));
    }, 2200);
  }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploadError("");
    const incoming = Array.from(list);
    const pendingCount = uploadEntries.filter((entry) => entry.status !== "done").length;
    const remaining = RESOURCE_UPLOAD_MAX_FILES - pendingCount;
    if (remaining <= 0) {
      setUploadError(
        `You can add up to ${RESOURCE_UPLOAD_MAX_FILES} files at a time. Upload or clear this batch first.`,
      );
      return;
    }

    const additions: UploadEntry[] = [];
    for (const file of incoming) {
      if (additions.length >= remaining) break;
      const duplicate = [...uploadEntries, ...additions].some(
        (entry) =>
          entry.status !== "done" &&
          entry.file.name === file.name &&
          entry.file.size === file.size &&
          entry.file.lastModified === file.lastModified,
      );
      if (duplicate) continue;

      const id = `${file.name}:${file.size}:${file.lastModified}:${Math.random()
        .toString(36)
        .slice(2)}`;
      const mimeType = normalizeUploadContentType(
        file.name,
        file.type,
        uploadMimes,
      );
      if (!mimeType) {
        additions.push({
          id,
          file,
          status: "error",
          progress: 0,
          error: "This file type is not supported.",
        });
        continue;
      }
      if (file.size < 1) {
        additions.push({
          id,
          file,
          status: "error",
          progress: 0,
          error: "This file is empty.",
        });
        continue;
      }
      if (file.size > RESOURCE_UPLOAD_MAX_BYTES) {
        additions.push({
          id,
          file,
          status: "error",
          progress: 0,
          error: `Must be ${formatBytes(RESOURCE_UPLOAD_MAX_BYTES)} or smaller.`,
        });
        continue;
      }
      additions.push({ id, file, status: "queued", progress: 0 });
    }

    if (additions.length === 0) {
      setUploadError("Those files are already in this batch.");
      return;
    }
    setUploadEntries((prev) => [...prev, ...additions]);
    if (incoming.length > remaining) {
      setUploadError(
        `Only ${remaining} more ${remaining === 1 ? "file fits" : "files fit"} in this batch.`,
      );
    }
  }

  function removeUploadEntry(id: string) {
    if (uploading) return;
    setUploadEntries((prev) => prev.filter((entry) => entry.id !== id));
  }

  function clearFinishedUploads() {
    setUploadEntries((prev) => prev.filter((entry) => entry.status !== "done"));
  }

  async function uploadAll() {
    const pending = uploadEntries.filter((entry) => entry.status === "queued");
    if (pending.length === 0 || uploading) return;

    setUploading(true);
    setUploadError("");
    const targetFolder = uploadFolderId || null;
    const note = uploadNotes.trim() || undefined;

    async function uploadOne(entry: UploadEntry): Promise<boolean> {
      setUploadEntries((prev) =>
        prev.map((item) =>
          item.id === entry.id
            ? { ...item, status: "uploading", progress: 0, error: undefined }
            : item,
        ),
      );

      let relayed: { fileKey: string; uploadId: string } | null = null;
      try {
        const mimeType = normalizeUploadContentType(
          entry.file.name,
          entry.file.type,
          uploadMimes,
        );
        if (!mimeType) throw new Error("This file type is not supported.");

        const presignRes = await fetch("/api/resources/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: entry.file.name,
            contentType: mimeType,
            fileSize: entry.file.size,
          }),
        });
        const presign = (await presignRes
          .json()
          .catch(() => ({}))) as UploadStart & { error?: unknown };
        if (!presignRes.ok) {
          throw new Error(errorMessage(presign, "Could not start the upload."));
        }
        const fileKey = presign.fileKey;
        const finalMime = presign.contentType ?? mimeType;
        if (!fileKey) throw new Error("Could not start the upload.");

        let parts: Array<{ partNumber: number; etag: string }> | undefined;

        if (presign.mode === "relay") {
          if (!presign.uploadId) throw new Error("Could not start the upload.");
          const uploadId = presign.uploadId;
          relayed = { fileKey, uploadId };
          const partSize = presign.partSize ?? RESOURCE_UPLOAD_PART_SIZE;
          const total = entry.file.size;
          parts = [];

          let sent = 0;
          let partNumber = 1;
          while (sent < total) {
            const end = Math.min(sent + partSize, total);
            const chunk = entry.file.slice(sent, end);
            const etag = await putPart(
              `/api/resources/uploads/part?uploadId=${encodeURIComponent(
                uploadId,
              )}&fileKey=${encodeURIComponent(fileKey)}&partNumber=${partNumber}`,
              chunk,
              (loaded) => {
                const uploaded = Math.min(total, sent + loaded);
                const progress = Math.min(
                  99,
                  Math.round((uploaded / total) * 100),
                );
                setUploadEntries((prev) =>
                  prev.map((item) =>
                    item.id === entry.id ? { ...item, progress } : item,
                  ),
                );
              },
            );
            parts.push({ partNumber, etag });
            sent = end;
            partNumber += 1;
          }
        } else {
          if (!presign.uploadUrl) throw new Error("Could not start the upload.");
          await putFile(presign.uploadUrl, entry.file, finalMime, (progress) => {
            setUploadEntries((prev) =>
              prev.map((item) =>
                item.id === entry.id ? { ...item, progress } : item,
              ),
            );
          });
        }

        const completeRes = await fetch("/api/resources/uploads/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileKey,
            fileName: entry.file.name,
            contentType: finalMime,
            fileSize: entry.file.size,
            folderId: targetFolder,
            notes: note,
            uploadId: relayed?.uploadId,
            parts,
          }),
        });
        const complete = await completeRes.json().catch(() => ({}));
        if (!completeRes.ok) {
          throw new Error(errorMessage(complete, "Could not save that file."));
        }
        relayed = null;

        const item = complete.item as ResourceItemRow;
        setItems((prev) => [item, ...prev]);
        setLibraryItems((prev) => [asOwnLibraryItem(item), ...prev]);
        setUploadEntries((prev) =>
          prev.map((entryItem) =>
            entryItem.id === entry.id
              ? { ...entryItem, status: "done", progress: 100 }
              : entryItem,
          ),
        );
        return true;
      } catch (err) {
        if (relayed) {
          void fetch("/api/resources/uploads/abort", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(relayed),
          }).catch(() => {});
        }
        setUploadEntries((prev) =>
          prev.map((entryItem) =>
            entryItem.id === entry.id
              ? {
                  ...entryItem,
                  status: "error",
                  error: (err as Error).message || "Upload failed.",
                }
              : entryItem,
          ),
        );
        return false;
      }
    }

    let cursor = 0;
    let succeeded = 0;
    async function worker() {
      while (cursor < pending.length) {
        const entry = pending[cursor];
        cursor += 1;
        if (await uploadOne(entry)) succeeded += 1;
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(UPLOAD_CONCURRENCY, pending.length) },
        () => worker(),
      ),
    );
    setUploading(false);
    if (succeeded > 0) setUploadNotes("");
  }

  const queuedUploads = uploadEntries.filter((entry) => entry.status === "queued").length;
  const finishedUploads = uploadEntries.filter((entry) => entry.status === "done").length;

  if (loading) {
    return <p className="py-16 text-center text-sm text-muted">Loading resources…</p>;
  }

  return (
    <div className="space-y-5">
      {/* Two clearly separated purposes: manage the library, or browse it. */}
      <div
        role="tablist"
        aria-label="Resources sections"
        className="grid gap-3 sm:grid-cols-2"
      >
        <button
          type="button"
          role="tab"
          id="resources-manage-tab"
          aria-selected={section === "manage"}
          aria-controls="resources-manage"
          onClick={() => setSection("manage")}
          className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
            section === "manage"
              ? "border-apex/40 bg-apex/5"
              : "border-line bg-surface hover:border-apex/30"
          }`}
        >
          <span
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              section === "manage"
                ? "bg-apex/15 text-apex"
                : "bg-surface text-muted"
            }`}
          >
            <FileUp size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Upload &amp; manage</span>
              <Badge color={section === "manage" ? "apex" : "neutral"}>
                {items.length}
              </Badge>
            </span>
            <span className="mt-1 block text-xs text-muted">
              Upload files, add links, organize folders and delete what you no
              longer need.
            </span>
          </span>
        </button>

        <button
          type="button"
          role="tab"
          id="resources-browse-tab"
          aria-selected={section === "browse"}
          aria-controls="resources-browse"
          onClick={() => setSection("browse")}
          className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
            section === "browse"
              ? "border-apex/40 bg-apex/5"
              : "border-line bg-surface hover:border-apex/30"
          }`}
        >
          <span
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              section === "browse"
                ? "bg-apex/15 text-apex"
                : "bg-surface text-muted"
            }`}
          >
            <Search size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Search &amp; view</span>
              <Badge color={section === "browse" ? "apex" : "neutral"}>
                {publicFileCount} public
              </Badge>
            </span>
            <span className="mt-1 block text-xs text-muted">
              Search every public upload from all accounts, plus your saved links.
              Preview files and copy a public link to share.
            </span>
          </span>
        </button>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      {section === "manage" ? (
        <div
          id="resources-manage"
          role="tabpanel"
          aria-labelledby="resources-manage-tab"
          className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]"
        >
          {/* Folders rail */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Layers size={15} className="text-apex" /> Folders
                </h2>
                <Badge color="neutral">{folders.length}</Badge>
              </div>

              <div className="space-y-0.5">
                <FolderButton
                  active={activeFolder === "all"}
                  onClick={() => setActiveFolder("all")}
                  icon={<Layers size={15} />}
                  label="All resources"
                  count={items.length}
                />
                <FolderButton
                  active={activeFolder === "unfiled"}
                  onClick={() => setActiveFolder("unfiled")}
                  icon={<Inbox size={15} />}
                  label="Unfiled"
                  count={unfiledCount}
                />

                <div className="my-2 border-t border-line" />

                {folders.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-muted">No folders yet.</p>
                ) : (
                  folders.map((folder) => {
                    const active = activeFolder === folder.id;
                    return (
                      <div key={folder.id} className="group flex items-center gap-1">
                        {renamingId === folder.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              saveRename(folder.id);
                            }}
                            className="flex flex-1 items-center gap-1"
                          >
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              className="input h-8 flex-1 py-1 text-xs"
                            />
                            <button
                              type="submit"
                              className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10"
                              aria-label="Save folder name"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenamingId(null)}
                              className="rounded p-1 text-muted hover:bg-surface"
                              aria-label="Cancel rename"
                            >
                              <X size={13} />
                            </button>
                          </form>
                        ) : (
                          <>
                            <button
                              onClick={() => setActiveFolder(folder.id)}
                              className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition ${
                                active
                                  ? "bg-apex/10 font-semibold text-apex"
                                  : "text-muted hover:bg-surface hover:text-foreground"
                              }`}
                            >
                              <Folder size={15} className="shrink-0" />
                              <span className="truncate">{folder.name}</span>
                              <span className="ml-auto text-xs text-muted/70">
                                {counts.get(folder.id) ?? 0}
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setRenamingId(folder.id);
                                setRenameValue(folder.name);
                              }}
                              aria-label="Rename folder"
                              className="rounded p-1 text-muted opacity-0 transition hover:bg-surface hover:text-foreground group-hover:opacity-100"
                            >
                              <Pencil size={12} />
                            </button>
                            {deleteFolderId === folder.id ? (
                              <button
                                onClick={() => deleteFolder(folder.id)}
                                aria-label="Confirm delete folder"
                                className="rounded bg-rose-500/20 p-1 text-rose-400"
                              >
                                <Check size={12} />
                              </button>
                            ) : (
                              <button
                                onClick={() => setDeleteFolderId(folder.id)}
                                aria-label="Delete folder"
                                className="rounded p-1 text-muted opacity-0 transition hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={createFolder} className="mt-3 flex items-center gap-1.5 border-t border-line pt-3">
                <input
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  placeholder="New folder…"
                  className="input h-9 flex-1 py-1 text-xs"
                  maxLength={60}
                />
                <Button
                  type="submit"
                  className="btn-primary h-9 shrink-0 px-2.5"
                  disabled={creatingFolder || !newFolder.trim()}
                  aria-label="Create folder"
                >
                  {creatingFolder ? <Loader2 size={14} className="animate-spin" /> : <FolderPlus size={15} />}
                </Button>
              </form>
            </Card>
          </aside>

          <div className="min-w-0 space-y-5">
            {/* Upload / link */}
            <Card className="p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Plus size={15} className="text-apex" /> Add a resource
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    Upload a document to your publishable library or save a link.
                  </p>
                </div>
                <div
                  role="tablist"
                  aria-label="Add resource"
                  className="inline-flex rounded-xl border border-line bg-surface p-0.5"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "upload"}
                    aria-controls="resource-upload-panel"
                    onClick={() => setMode("upload")}
                    disabled={uploading}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      mode === "upload"
                        ? "bg-apex/15 text-apex"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <Upload size={13} /> Upload
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "link"}
                    aria-controls="resource-link-panel"
                    onClick={() => setMode("link")}
                    disabled={uploading}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      mode === "link"
                        ? "bg-apex/15 text-apex"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <Link2 size={13} /> Link
                  </button>
                </div>
              </div>

              {mode === "upload" ? (
                <div
                  id="resource-upload-panel"
                  role="tabpanel"
                  className="space-y-3"
                >
                  <div
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      addFiles(e.dataTransfer.files);
                    }}
                    className={`flex flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-7 text-center transition ${
                      dragActive
                        ? "border-apex bg-apex/5"
                        : "border-line bg-surface"
                    }`}
                  >
                    <span className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-apex/10 text-apex">
                      <FileUp size={21} />
                    </span>
                    <p className="text-sm font-medium">Drag &amp; drop documents here</p>
                    <p className="mt-1 max-w-md text-xs text-muted">
                      {uploadTypeLabel}. Up to{" "}
                      {formatBytes(RESOURCE_UPLOAD_MAX_BYTES)} per file,{" "}
                      {RESOURCE_UPLOAD_MAX_FILES} files at a time.
                    </p>
                    <Button
                      type="button"
                      className="mt-3"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload size={15} /> Choose files
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={resourceUploadAccept(uploadMimes)}
                      tabIndex={-1}
                      className="sr-only"
                      aria-label="Choose documents to upload"
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  <p className="inline-flex items-start gap-1.5 rounded-xl border border-apex/20 bg-apex/5 px-3 py-2 text-[11px] text-muted">
                    <Globe2 size={13} className="mt-0.5 shrink-0 text-apex" />
                    Uploaded files get a public link. Anyone who has the link can
                    view the file — delete the item to remove access.
                  </p>

                  {uploadEntries.length > 0 ? (
                    <ul className="space-y-2" aria-live="polite">
                      {uploadEntries.map((entry) => (
                        <li
                          key={entry.id}
                          className="rounded-xl border border-line bg-surface px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                entry.status === "error"
                                  ? "bg-rose-500/10 text-rose-400"
                                  : entry.status === "done"
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-apex/10 text-apex"
                              }`}
                            >
                              <File size={15} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">
                                {entry.file.name}
                              </p>
                              <p className="text-[11px] text-muted">
                                {formatBytes(entry.file.size)}
                                {entry.status === "queued"
                                  ? " · Ready"
                                  : entry.status === "uploading"
                                    ? ` · Uploading ${entry.progress}%`
                                    : entry.status === "done"
                                      ? " · Uploaded"
                                      : " · Not uploaded"}
                              </p>
                            </div>
                            {entry.status === "done" ? (
                              <Check size={15} className="shrink-0 text-emerald-400" />
                            ) : null}
                            {!uploading && entry.status !== "uploading" ? (
                              <button
                                type="button"
                                onClick={() => removeUploadEntry(entry.id)}
                                aria-label={`Remove ${entry.file.name}`}
                                className="rounded-lg p-1 text-muted transition hover:bg-surface hover:text-foreground"
                              >
                                <X size={14} />
                              </button>
                            ) : null}
                          </div>

                          {entry.status === "uploading" ? (
                            <div
                              className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
                              role="progressbar"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={entry.progress}
                              aria-label={`Uploading ${entry.file.name}`}
                            >
                              <div
                                className="h-full rounded-full bg-apex-gradient transition-all"
                                style={{ width: `${entry.progress}%` }}
                              />
                            </div>
                          ) : null}

                          {entry.status === "error" && entry.error ? (
                            <p className="mt-1.5 text-[11px] text-rose-400">
                              {entry.error}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <Label htmlFor="upload-folder">Save to</Label>
                      <select
                        id="upload-folder"
                        value={uploadFolderId}
                        onChange={(e) => setUploadFolderId(e.target.value)}
                        className="input"
                        disabled={uploading}
                      >
                        <option value="">Unfiled</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="upload-notes">Notes (optional)</Label>
                      <Input
                        id="upload-notes"
                        value={uploadNotes}
                        onChange={(e) => setUploadNotes(e.target.value)}
                        placeholder="What is this document for?"
                        disabled={uploading}
                      />
                    </div>
                  </div>

                  {uploadError ? (
                    <p className="text-xs text-rose-400">{uploadError}</p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      className="btn-primary"
                      onClick={uploadAll}
                      disabled={uploading || queuedUploads === 0}
                    >
                      {uploading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Upload size={16} />
                      )}
                      {uploading
                        ? "Uploading…"
                        : queuedUploads > 0
                          ? `Upload ${queuedUploads} ${queuedUploads === 1 ? "file" : "files"}`
                          : "Upload files"}
                    </Button>
                    {finishedUploads > 0 ? (
                      <Button
                        type="button"
                        onClick={clearFinishedUploads}
                        disabled={uploading}
                      >
                        Clear finished
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <form
                  id="resource-link-panel"
                  role="tabpanel"
                  onSubmit={addResource}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Label htmlFor="res-url">Link</Label>
                      <div className="relative">
                        <Input
                          id="res-url"
                          value={url}
                          onChange={(e) => onUrlChange(e.target.value)}
                          placeholder="https://… (PDF, image, YouTube, any web page)"
                          autoComplete="off"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 text-xs text-muted">
                          <KindIcon kind={kind} size={14} />
                          {RESOURCE_KIND_META[kind].label}
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="res-title">Title (optional)</Label>
                      <Input
                        id="res-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Defaults to the site name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="res-folder">Folder</Label>
                      <select
                        id="res-folder"
                        value={folderId}
                        onChange={(e) => setFolderId(e.target.value)}
                        className="input"
                      >
                        <option value="">Unfiled</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="res-kind">Type</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {LINK_KINDS.map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => {
                              setKind(k);
                              setKindTouched(true);
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                              kind === k
                                ? "border-apex/40 bg-apex/10 font-semibold text-apex"
                                : "border-line bg-surface text-muted hover:border-apex/30"
                            }`}
                          >
                            <KindIcon kind={k} size={12} />
                            {RESOURCE_KIND_META[k].label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="res-notes">Notes (optional)</Label>
                      <Input
                        id="res-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Why is this useful?"
                      />
                    </div>
                  </div>

                  {addError ? <p className="text-xs text-rose-400">{addError}</p> : null}

                  <Button type="submit" className="btn-primary" disabled={adding}>
                    {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Save resource
                  </Button>
                </form>
              )}
            </Card>

            {/* Manage list */}
            <Card className="p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                    <HardDrive size={15} className="text-apex" /> Your library
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    Showing <span className="text-foreground">{activeFolderName}</span>.
                    Move items between folders, copy a public link or delete them.
                  </p>
                </div>
                <Badge color="apex">{manageItems.length}</Badge>
              </div>

              {manageItems.length === 0 ? (
                <EmptyState
                  icon={<Inbox size={24} />}
                  title={
                    items.length === 0
                      ? "Your library is empty"
                      : `${activeFolderName} is empty`
                  }
                  subtitle={
                    items.length === 0
                      ? "Upload a document or save a link above to get started."
                      : "Add a resource here, or move something into this folder."
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {manageItems.map((item) => {
                    const stored = isStoredItem(item);
                    return (
                      <li
                        key={item.id}
                        className="rounded-2xl border border-line bg-surface p-3.5 transition hover:border-apex/25"
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <span
                            className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-apex/10 ${RESOURCE_KIND_META[item.kind].color}`}
                          >
                            <KindIcon kind={item.kind} size={17} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={openHrefForItem(item)}
                                target={item.kind === 'PDF' || item.fileName?.toLowerCase().endsWith('.pdf') ? '_self' : '_blank'}
                                rel={item.kind === 'PDF' || item.fileName?.toLowerCase().endsWith('.pdf') ? undefined : 'noopener noreferrer'}
                                title={stored ? item.fileName ?? item.title : item.url}
                                className="min-w-0 truncate text-sm font-semibold hover:text-apex"
                              >
                                {item.title}
                              </a>
                              {stored ? (
                                <Badge color="apex">
                                  <Globe2 size={11} /> Public
                                </Badge>
                              ) : (
                                <Badge color="neutral">Link</Badge>
                              )}
                            </div>
                            <p className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-muted">
                              {stored ? (
                                <HardDrive size={11} className="shrink-0" />
                              ) : (
                                <ExternalLink size={11} className="shrink-0" />
                              )}
                              <span className="truncate">
                                {stored
                                  ? `Uploaded file${
                                      item.fileSize
                                        ? ` · ${formatBytes(item.fileSize)}`
                                        : ""
                                    }`
                                  : `Saved link · ${hostnameOf(item.url)}`}
                              </span>
                            </p>
                            {item.notes ? (
                              <p className="mt-1.5 line-clamp-2 text-xs text-muted">
                                {item.notes}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => copyItemLink(item)}
                              aria-label={stored ? "Copy public link" : "Copy link"}
                              title={stored ? "Copy public link" : "Copy link"}
                              className="rounded-lg p-1.5 text-muted transition hover:bg-apex/10 hover:text-apex"
                            >
                              {copiedId === item.id ? (
                                <Check size={15} className="text-emerald-400" />
                              ) : (
                                <Copy size={15} />
                              )}
                            </button>
                            {stored ? (
                              <button
                                type="button"
                                onClick={() => downloadItem(item)}
                                disabled={downloadingId === item.id}
                                aria-label="Download file"
                                title="Download file"
                                className="rounded-lg p-1.5 text-muted transition hover:bg-apex/10 hover:text-apex disabled:opacity-50"
                              >
                                {downloadingId === item.id ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <Download size={15} />
                                )}
                              </button>
                            ) : null}
                            <a
                              href={openHrefForItem(item)}
                              target={item.kind === 'PDF' || item.fileName?.toLowerCase().endsWith('.pdf') ? '_self' : '_blank'}
                              rel={item.kind === 'PDF' || item.fileName?.toLowerCase().endsWith('.pdf') ? undefined : 'noopener noreferrer'}
                              aria-label={stored ? "Open file" : "Open link"}
                              title={stored ? "Open file" : "Open link"}
                              className="rounded-lg p-1.5 text-muted transition hover:bg-apex/10 hover:text-apex"
                            >
                              {stored ? <File size={15} /> : <ExternalLink size={15} />}
                            </a>
                            <button
                              type="button"
                              onClick={() => deleteItem(item.id)}
                              disabled={busyId === item.id}
                              aria-label="Delete resource"
                              title="Delete resource"
                              className="rounded-lg p-1.5 text-muted transition hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
                            >
                              {busyId === item.id ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <Trash2 size={15} />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                          <select
                            value={item.folderId ?? ""}
                            onChange={(e) => moveItem(item, e.target.value)}
                            className="input h-8 w-full max-w-[220px] py-0 text-xs"
                            aria-label="Move to folder"
                          >
                            <option value="">Unfiled</option>
                            {folders.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                          <span className="text-[11px] text-muted">
                            {stored
                              ? "Anyone with the public link can view this file."
                              : `Saved from ${hostnameOf(item.url)}.`}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <div
          id="resources-browse"
          role="tabpanel"
          aria-labelledby="resources-browse-tab"
          className="space-y-5"
        >
          {/* Search + filters */}
          <Card className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, file, link, notes or type…"
                  className="pl-9"
                  aria-label="Search resources"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              <div className="lg:w-56">
                <select
                  value={browseOwner}
                  onChange={(e) =>
                    setBrowseOwner(e.target.value === "mine" ? "mine" : "all")
                  }
                  className="input py-2.5 text-sm"
                  aria-label="Filter by owner"
                >
                  <option value="all">Everyone</option>
                  <option value="mine">Only my resources</option>
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
              <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                Type
              </span>
              <button
                type="button"
                onClick={() => setBrowseKind("ALL")}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                  browseKind === "ALL"
                    ? "border-apex/40 bg-apex/10 font-semibold text-apex"
                    : "border-line bg-surface text-muted hover:border-apex/30"
                }`}
              >
                <Layers size={12} /> All
              </button>
              {browseKinds.map((resourceKind) => (
                <button
                  key={resourceKind}
                  type="button"
                  onClick={() => setBrowseKind(resourceKind)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                    browseKind === resourceKind
                      ? "border-apex/40 bg-apex/10 font-semibold text-apex"
                      : "border-line bg-surface text-muted hover:border-apex/30"
                  }`}
                >
                  <KindIcon kind={resourceKind} size={12} />
                  {RESOURCE_KIND_META[resourceKind].label}
                </button>
              ))}
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {browseItems.length}{" "}
              {browseItems.length === 1 ? "resource" : "resources"}
              {hasBrowseFilters ? " matching your filters" : " in the public library"}
            </p>
            <div className="flex items-center gap-3">
              {hasBrowseFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setBrowseKind("ALL");
                    setBrowseOwner("all");
                  }}
                  className="text-xs text-muted underline-offset-2 transition hover:text-apex hover:underline"
                >
                  Reset filters
                </button>
              ) : null}
              <Badge color="apex">
                {publicFileCount}{" "}
                {publicFileCount === 1 ? "public file" : "public files"}
              </Badge>
            </div>
          </div>

          {browseItems.length === 0 ? (
            <div className="space-y-4">
              <EmptyState
                icon={<Search size={24} />}
                title={hasBrowseFilters ? "No matches" : "Nothing to browse yet"}
                subtitle={
                  hasBrowseFilters
                    ? "Try a different search term, type or owner."
                    : "Upload a document in Upload & manage — every file you upload appears here for all accounts."
                }
              />
              {!hasBrowseFilters ? (
                <div className="text-center">
                  <Button
                    type="button"
                    className="btn-primary"
                    onClick={() => setSection("manage")}
                  >
                    <Plus size={15} /> Add your first resource
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {browseItems.map((item) => {
                const stored = isStoredItem(item);
                return (
                  <article
                    key={item.id}
                    className="flex flex-col rounded-2xl border border-line bg-surface p-4 transition hover:border-apex/30"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-apex/10 ${RESOURCE_KIND_META[item.kind].color}`}
                      >
                        <KindIcon kind={item.kind} size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <a
                          href={openHrefForItem(item)}
                          target={item.kind === 'PDF' || item.fileName?.toLowerCase().endsWith('.pdf') ? '_self' : '_blank'}
                          rel={item.kind === 'PDF' || item.fileName?.toLowerCase().endsWith('.pdf') ? undefined : 'noopener noreferrer'}
                          title={stored ? item.fileName ?? item.title : item.url}
                          className="line-clamp-2 text-sm font-semibold hover:text-apex"
                        >
                          {item.title}
                        </a>
                        <p className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-muted">
                          {stored ? (
                            <HardDrive size={11} className="shrink-0" />
                          ) : (
                            <ExternalLink size={11} className="shrink-0" />
                          )}
                          <span className="truncate">
                            {stored
                              ? `Public file${
                                  item.fileSize
                                    ? ` · ${formatBytes(item.fileSize)}`
                                    : ""
                                }`
                              : hostnameOf(item.url)}
                          </span>
                        </p>
                      </div>
                      {stored ? (
                        <Badge color="apex">
                          <Globe2 size={11} /> Public
                        </Badge>
                      ) : null}
                    </div>

                    {item.notes ? (
                      <p className="mt-2 line-clamp-2 text-xs text-muted">
                        {item.notes}
                      </p>
                    ) : null}

                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted">
                      <UserRound size={11} className="shrink-0" />
                      <span className="truncate">
                        {item.isOwner
                          ? "Added by you"
                          : `Added by ${ownerLabelOf(item)}`}
                      </span>
                    </p>

                    <div className="mt-auto flex items-center gap-2 border-t border-line pt-3">
                      <a
                        href={openHrefForItem(item)}
                        target={item.kind === 'PDF' || item.fileName?.toLowerCase().endsWith('.pdf') ? '_self' : '_blank'}
                        rel={item.kind === 'PDF' || item.fileName?.toLowerCase().endsWith('.pdf') ? undefined : 'noopener noreferrer'}
                        className="btn btn-primary btn-sm flex-1"
                      >
                        <ExternalLink size={14} /> {stored ? "View file" : "Open link"}
                      </a>
                      {stored ? (
                        <button
                          type="button"
                          onClick={() => downloadItem(item)}
                          disabled={downloadingId === item.id}
                          aria-label="Download file"
                          title="Download file"
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition hover:border-apex/30 hover:text-apex disabled:opacity-50"
                        >
                          {downloadingId === item.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Download size={15} />
                          )}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => copyItemLink(item)}
                        aria-label={stored ? "Copy public link" : "Copy link"}
                        title={stored ? "Copy public link" : "Copy link"}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition hover:border-apex/30 hover:text-apex"
                      >
                        {copiedId === item.id ? (
                          <Check size={15} className="text-emerald-400" />
                        ) : (
                          <Copy size={15} />
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FolderButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition ${
        active
          ? "bg-apex/10 font-semibold text-apex"
          : "text-muted hover:bg-surface hover:text-foreground"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
      <span className="ml-auto text-xs text-muted/70">{count}</span>
    </button>
  );
}
