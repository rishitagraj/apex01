"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Hash,
  MessageSquarePlus,
  Send,
  Trash2,
  Loader2,
  ArrowUp,
  ImagePlus,
  X,
} from "lucide-react";

type Channel = { id: string; name: string; sortOrder: number };
type Message = {
  id: string;
  channelId: string;
  userId: string;
  authorName: string;
  content: string;
  imageKey?: string | null;
  imageType?: string | null;
  createdAt: string;
};

type Attachment = {
  file: File;
  preview: string;
  imageKey?: string;
  imageType?: string;
  uploading: boolean;
};

const PAGE_SIZE = 60;
const POLL_MS = 4000;
export const CHAT_IMAGE_LIMIT_MB = 500;

const AVATAR_COLORS = [
  "bg-gradient-to-br from-apex to-apex2",
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-sky-500 to-indigo-600",
  "bg-gradient-to-br from-rose-500 to-pink-600",
  "bg-gradient-to-br from-amber-500 to-orange-600",
  "bg-gradient-to-br from-violet-500 to-purple-600",
];

export function CommunityChat() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [draft, setDraft] = useState("");
  const [attach, setAttach] = useState<Attachment | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stickRef = useRef(true);
  const initializedRef = useRef(false);

  const activeChannel =
    channels.find((c) => c.id === activeId) ?? channels[0] ?? null;

  useEffect(() => {
    fetch("/api/community/channels")
      .then((r) => r.json())
      .then((data) => {
        const list: Channel[] = data.channels ?? [];
        setChannels(list);
        setIsAdmin(data.isAdmin === true);
        if (!initializedRef.current && list.length > 0) {
          initializedRef.current = true;
          setActiveId(list[0].id);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError("Could not load channels. Try refreshing.");
      });
  }, []);

  const refresh = useCallback(async (channelId: string, anchor?: string) => {
    try {
      const res = await fetch(
        `/api/community/messages?channel=${encodeURIComponent(channelId)}${
          anchor ? `&before=${encodeURIComponent(anchor)}` : ""
        }`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load messages.");
        return;
      }
      setViewerId(data.viewerId);
      if (anchor) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const older = (data.messages as Message[]).filter((m) => !ids.has(m.id));
          return [...older, ...prev];
        });
        stickRef.current = false;
      } else {
        setMessages(data.messages as Message[]);
        stickRef.current = true;
      }
      setHasOlder((data.messages as Message[]).length >= PAGE_SIZE);
      setError(null);
    } catch {
      setError("Connection lost. Retrying…");
    }
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const timer = setInterval(() => refresh(activeId), POLL_MS);
    const boot = setTimeout(() => refresh(activeId), 0);
    return () => {
      clearTimeout(boot);
      clearInterval(timer);
    };
  }, [activeId, refresh]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function uploadAttachment(a: Attachment): Promise<{ imageKey: string; imageType: string }> {
    const res = await fetch("/api/community/images/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: a.file.name,
        contentType: a.file.type,
        fileSize: a.file.size,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(errToString(data.error));
    const upload = await fetch(data.uploadUrl as string, {
      method: "PUT",
      headers: { "Content-Type": a.file.type },
      body: new Uint8Array(await a.file.arrayBuffer()),
    });
    if (!upload.ok) throw new Error(`Image upload failed (${upload.status})`);
    return { imageKey: data.imageKey as string, imageType: data.imageType as string };
  }

  async function sendMessage() {
    const content = draft;
    if (!activeId || sending) return;
    if (!attach && !content.trim()) return;
    if (attach && !attach.uploading) {
      setAttach({ ...attach, uploading: true });
    }
    setSending(true);
    try {
      let imageKey: string | undefined;
      let imageType: string | undefined;
      if (attach && !attach.imageKey) {
        const uploaded = await uploadAttachment(attach);
        imageKey = uploaded.imageKey;
        imageType = uploaded.imageType;
      } else if (attach?.imageKey) {
        imageKey = attach.imageKey;
        imageType = attach.imageType;
      }

      const res = await fetch("/api/community/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: activeId,
          content,
          imageKey,
          imageType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(errToString(data.error));
        return;
      }
      setMessages((prev) => [...prev, data.message as Message]);
      setDraft("");
      if (attach?.preview) URL.revokeObjectURL(attach.preview);
      setAttach(null);
      stickRef.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the message.");
    } finally {
      setSending(false);
    }
  }

  async function loadOlder() {
    if (!activeId || !messages[0] || moreLoading) return;
    setMoreLoading(true);
    try {
      await refresh(activeId, messages[0].id);
    } finally {
      setMoreLoading(false);
    }
  }

  async function createChannel() {
    const name = window.prompt("New channel name (lowercase letters, numbers, dashes):");
    if (!name) return;
    const res = await fetch("/api/community/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(errToString(data.error));
      return;
    }
    setChannels((prev) => [...prev, data.channel as Channel]);
    setActiveId((data.channel as Channel).id);
  }

  async function deleteChannel(id: string) {
    const channel = channels.find((c) => c.id === id);
    const ok = window.confirm(
      `Delete "#${channel?.name ?? "channel"}" and all its messages? This cannot be undone.`,
    );
    if (!ok) return;
    const res = await fetch(`/api/community/channels/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(errToString(data?.error));
      return;
    }
    const next = channels.filter((c) => c.id !== id);
    setChannels(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  }

  async function deleteMessage(id: string) {
    const res = await fetch(`/api/community/messages/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } else {
      const data = await res.json().catch(() => null);
      setError(errToString(data?.error));
    }
  }

  function pickFile(file: File | undefined | null) {
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setError("Only PNG, JPG, WebP and GIF images are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Images must be 10 MB or smaller.");
      return;
    }
    setAttach({ file, preview: URL.createObjectURL(file), uploading: false });
  }

  function clearAttach() {
    if (attach?.preview) URL.revokeObjectURL(attach.preview);
    setAttach(null);
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-12rem)] min-h-[540px] items-center justify-center rounded-3xl border border-line bg-card">
        <Loader2 size={22} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[540px] overflow-hidden rounded-3xl border border-line bg-card">
      <aside className="flex w-44 shrink-0 flex-col border-r border-line bg-black/15 md:w-56">
        <div className="flex items-center justify-between px-4 pb-1 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Channels
          </p>
          {isAdmin ? (
            <button
              onClick={createChannel}
              className="rounded-lg p-1 text-muted transition hover:bg-surface hover:text-apex"
              aria-label="Create channel"
              title="Create channel"
            >
              <MessageSquarePlus size={15} />
            </button>
          ) : null}
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {isAdmin ? (
            <p className="px-2 pt-1 text-[10px] text-muted">
              {CHAT_IMAGE_LIMIT_MB} MB shared image limit
            </p>
          ) : null}
          {channels.map((ch) => {
            const active = ch.id === activeChannel?.id;
            return (
              <div key={ch.id} className="group relative flex items-center">
                <button
                  onClick={() => setActiveId(ch.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 pr-8 text-sm transition ${
                    active
                      ? "bg-apex/15 font-medium text-apex"
                      : "text-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <Hash size={15} className="shrink-0 opacity-70" />
                  <span className="truncate">{ch.name}</span>
                </button>
                {isAdmin ? (
                  <button
                    onClick={() => deleteChannel(ch.id)}
                    className="absolute right-1.5 rounded-md p-1 text-muted opacity-0 transition hover:bg-surface hover:text-rose-400 group-hover:opacity-100"
                    aria-label={`Delete #${ch.name}`}
                    title={`Delete #${ch.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Hash size={17} className="text-muted" />
          <span className="truncate font-semibold">
            {activeChannel?.name ?? "chat"}
          </span>
          <span className="hidden text-xs text-muted sm:inline">
            · {messages.length} shown
          </span>
        </div>

        {error ? (
          <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
            {error}
            <button
              className="ml-2 underline"
              onClick={() => activeId && refresh(activeId)}
            >
              retry
            </button>
          </div>
        ) : null}

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
        >
          {hasOlder ? (
            <button
              onClick={loadOlder}
              disabled={moreLoading}
              className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition hover:bg-surface hover:text-foreground disabled:opacity-50"
            >
              {moreLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <ArrowUp size={12} />
              )}
              Load earlier
            </button>
          ) : null}

          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <MessageSquarePlus size={26} className="text-muted" />
              <p className="text-sm font-medium">No messages yet</p>
              <p className="max-w-xs text-xs text-muted">
                Say hi and start the conversation in #{activeChannel?.name ?? "chat"}.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <MessageRow
                key={m.id}
                message={m}
                deletable={m.userId === viewerId}
                onDelete={() => deleteMessage(m.id)}
              />
            ))
          )}
        </div>

        <form
          className="border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          {attach ? (
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-line bg-black/20 p-2">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                <img
                  src={attach.preview}
                  alt="Attachment preview"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{attach.file.name}</p>
                {attach.uploading ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted">
                    <Loader2 size={11} className="animate-spin" /> Uploading…
                  </p>
                ) : attach.imageKey ? (
                  <p className="text-[11px] text-emerald-400">Uploaded</p>
                ) : (
                  <p className="text-[11px] text-muted">
                    Add a caption or send as-is
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={clearAttach}
                disabled={attach.uploading}
                className="rounded-lg p-1 text-muted transition hover:bg-surface hover:text-rose-400 disabled:opacity-50"
                aria-label="Remove attachment"
              >
                <X size={15} />
              </button>
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn shrink-0 px-3"
              aria-label="Attach an image or GIF"
              title="Attach an image or GIF"
            >
              <ImagePlus size={17} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
              placeholder={`Message #${activeChannel?.name ?? "chat"}`}
              className="input max-h-32 min-h-[42px] resize-y"
            />
            <button
              type="submit"
              disabled={
                sending ||
                (attach ? attach.uploading : false) ||
                (!draft.trim() && !attach)
              }
              className="btn shrink-0 bg-apex-gradient px-4 text-white disabled:opacity-40"
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted">
            PNG / JPG / WebP / GIF up to 10 MB · Enter to send · Shift+Enter for a new line
          </p>
        </form>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  deletable,
  onDelete,
}: {
  message: Message;
  deletable: boolean;
  onDelete: () => void;
}) {
  const color = AVATAR_COLORS[hashText(message.authorName) % AVATAR_COLORS.length];
  return (
    <div className="group flex gap-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${color}`}
      >
        {message.authorName.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{message.authorName}</span>
          <span className="text-[10px] text-muted">{timeAgo(message.createdAt)}</span>
          {deletable ? (
            <button
              onClick={onDelete}
              className="ml-auto rounded-md p-1 text-muted opacity-0 transition hover:bg-surface hover:text-rose-400 group-hover:opacity-100"
              aria-label="Delete message"
              title="Delete message"
            >
              <Trash2 size={13} />
            </button>
          ) : null}
        </div>
        {message.imageKey ? (
          <img
            src={`/api/community/images/${encodeURIComponent(message.imageKey)}`}
            alt={message.content || "Shared image"}
            loading="lazy"
            className="mt-1.5 max-h-80 w-auto max-w-full rounded-2xl border border-line object-contain"
          />
        ) : null}
        {message.content ? (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
            {message.content}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 10) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

function errToString(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const field = err as Record<string, unknown>;
    for (const value of Object.values(field)) {
      if (Array.isArray(value) && value.length > 0) return String(value[0]);
      if (typeof value === "string") return value;
    }
  }
  return "Something went wrong.";
}