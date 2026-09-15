"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Video, Users, Crown, X } from "lucide-react";
import { Spinner, formatMinutes } from "@/components/ui";

type Participant = {
  id: string;
  name: string;
  minutes: number;
  totalMinutes: number;
  active: boolean;
};

type MeetingRoomProps = {
  code: string;
  hostId: string;
  userName: string;
  roomName: string;
  meetingName: string;
};

declare global {
  interface Window {
    IframeApi?: new (
      domain: string,
      options: {
        room: string;
        name: string;
        audio: number;
        video: number;
        screen: number;
        chat: number;
        hide: number;
        notify: number;
        width: string;
        height: string;
        parentNode: HTMLElement;
      },
    ) => { dispose?: () => void };
  }
}

// NEXT_PUBLIC_* vars are inlined at build time. If unset, refuse to load any
// fallback server rather than silently routing users to a public MiroTalk host.
const MIROTALK_DOMAIN = process.env.NEXT_PUBLIC_MIROTALK_DOMAIN ?? "";
const MISCONFIGURED = !MIROTALK_DOMAIN;
const HEARTBEAT_MS = 60_000;
const POLL_MS = 20_000;

export function MeetingRoom({
  code,
  hostId,
  userName,
  roomName,
  meetingName,
}: MeetingRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<InstanceType<NonNullable<typeof window.IframeApi>> | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [joined, setJoined] = useState(false);
  const [scriptOk, setScriptOk] = useState(true);
  const [scriptLoading, setScriptLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const roomUrl = MIROTALK_DOMAIN ? `https://${MIROTALK_DOMAIN}/${roomName}` : "";

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${code}`);
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.room?.participants ?? []);
      }
    } catch {
      // ignore
    }
  }, [code]);

  // load MiroTalk P2P iframe API script
  useEffect(() => {
    let disposed = false;

    async function load() {
      if (MISCONFIGURED) {
        if (!disposed) {
          setScriptLoading(false);
          setScriptOk(false);
        }
        return;
      }
      if (window.IframeApi) {
        setScriptLoading(false);
        mount();
        return;
      }
      const src = `https://${MIROTALK_DOMAIN}/js/iframe.js`;
      const waitForExisting = () => {
        const wait = setInterval(() => {
          if (window.IframeApi) {
            clearInterval(wait);
            if (!disposed) {
              setScriptLoading(false);
              mount();
            }
          }
        }, 200);
      };
      if (document.querySelector(`script[src="${src}"]`)) {
        waitForExisting();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => {
        if (!disposed) {
          setScriptLoading(false);
          mount();
        }
      };
      s.onerror = () => {
        if (!disposed) {
          setScriptLoading(false);
          setScriptOk(false);
        }
      };
      s.src = src;
      document.body.appendChild(s);
    }

    function mount() {
      if (!containerRef.current || disposed) return;
      try {
        apiRef.current = new window.IframeApi!(MIROTALK_DOMAIN, {
          room: roomName,
          name: userName,
          audio: 1,
          video: 1,
          screen: 1,
          chat: 0,
          hide: 0,
          notify: 0,
          width: "100%",
          height: "100%",
          parentNode: containerRef.current,
        });
        if (!disposed) setJoined(true);
      } catch {
        if (!disposed) setScriptOk(false);
      }
    }

    load();

    return () => {
      disposed = true;
      try {
        if (typeof apiRef.current?.dispose === "function") apiRef.current.dispose();
      } catch {
        // ignore
      }
    };
  }, [userName, roomName]);

  // heartbeat + polling
  useEffect(() => {
    fetch(`/api/meetings/${code}/join`, { method: "POST" }).catch(() => {});

    const h = setInterval(() => {
      fetch(`/api/meetings/${code}/heartbeat`, { method: "POST" }).catch(() => {});
    }, HEARTBEAT_MS);

    const t = setTimeout(poll, 0);
    const p = setInterval(poll, POLL_MS);

    return () => {
      clearInterval(h);
      clearInterval(t);
      clearInterval(p);
    };
  }, [code, poll]);

  const liveCount = participants.filter((p) => p.active).length;

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-2xl">
      {MISCONFIGURED ? (
        <div className="absolute inset-0 flex items-center justify-center bg-card p-6 text-center">
          <div className="max-w-md">
            <p className="text-sm font-semibold text-red-400">Video is disabled</p>
            <p className="mt-2 text-sm text-muted">
              This deployment is missing{" "}
              <span className="font-mono">NEXT_PUBLIC_MIROTALK_DOMAIN</span>, so the room will not
              connect to any video server. Set the env var to your private MiroTalk P2P instance and
              redeploy — no fallback or public server is used.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Video area fills 100% */}
          <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
        {scriptLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/50">
            <Spinner className="text-apex" />
            <p className="text-sm text-muted">Loading video…</p>
          </div>
        )}
        {!scriptOk && (
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <div className="px-4">
              <p className="text-sm text-muted">
                Could not load the video SDK from{" "}
                <span className="font-mono">{MIROTALK_DOMAIN}</span>.
              </p>
              <a
                href={roomUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-apex-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg"
              >
                <Video size={16} /> Open in new tab
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Floating top-left room badge */}
      <div className="absolute left-4 top-4 z-20">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-sm">
          <Video size={13} className="text-apex" />
          <span className="text-xs font-medium text-white/90">{meetingName}</span>
          <span className="text-[11px] text-white/50">· {roomName}</span>
        </div>
      </div>

      {/* Floating top-right controls */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <button
          onClick={() => setShowPanel((v) => !v)}
          aria-label="Toggle participants"
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition ${
            showPanel
              ? "border-apex/40 bg-apex/10 text-apex"
              : "border-white/10 bg-black/50 text-white/90 hover:bg-black/70"
          }`}
        >
          <Users size={14} /> {liveCount}
        </button>
        <a
          href={roomUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm transition hover:bg-black/70"
        >
          <Video size={14} className="text-apex" /> Open in new tab
        </a>
      </div>

      {/* Floating participants panel */}
      {showPanel && (
        <aside className="absolute right-4 top-16 z-30 flex h-[calc(100%-5rem)] w-72 flex-col overflow-hidden rounded-2xl border border-white/10 bg-card/95 shadow-2xl backdrop-blur-sm">
          <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users size={15} className="text-muted" />
              Participants
            </div>
            <div className="flex items-center gap-2">
              <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                {liveCount} live
              </span>
              <button
                onClick={() => setShowPanel(false)}
                aria-label="Close participants"
                className="rounded-lg p-1 text-muted transition hover:bg-surface hover:text-foreground"
              >
                <X size={15} />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {participants.length === 0 ? (
                <div className="py-6 text-center">
                  <Spinner className="mx-auto text-muted" />
                  <p className="mt-2 text-xs text-muted">Waiting for participants…</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {participants.map((p) => {
                    const isHost = p.id === hostId;
                    return (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-surface"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-apex-gradient text-xs font-bold text-white">
                          {p.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium">{p.name}</span>
                            {isHost ? (
                              <Crown size={12} className="shrink-0 text-apex" />
                            ) : null}
                          </div>
                          <span className="text-xs text-muted">
                            {p.active ? (
                              <>
                                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Active · {formatMinutes(p.minutes)}
                              </>
                            ) : (
                              formatMinutes(p.minutes)
                            )}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <footer className="shrink-0 border-t border-line p-3 text-center text-xs text-muted">
              <p className="font-mono">Room: {roomName}</p>
              <p className="mt-1">
                {!joined ? <Spinner className="mr-1 inline" /> : null}
                {!joined ? "Connecting…" : "Connected"}
              </p>
            </footer>
          </aside>
        )}
        </>
      )}
    </div>
  );
}