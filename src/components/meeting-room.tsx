"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Video, Users, Crown } from "lucide-react";
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
};

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: Record<string, unknown>,
    ) => { dispose: () => void; addEventListener: (e: string, cb: () => void) => void };
  }
}

const JITSI_DOMAIN = process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.jit.si";
const HEARTBEAT_MS = 60_000;
const POLL_MS = 20_000;

export function MeetingRoom({
  code,
  hostId,
  userName,
  roomName,
}: MeetingRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<InstanceType<NonNullable<typeof window.JitsiMeetExternalAPI>> | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [joined, setJoined] = useState(false);
  const [scriptOk, setScriptOk] = useState(true);
  const [scriptLoading, setScriptLoading] = useState(true);
  const roomUrl = `https://${JITSI_DOMAIN}/Apex01-${roomName}`;

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

  // load Jitsi external API script
  useEffect(() => {
    let disposed = false;

    async function load() {
      if (window.JitsiMeetExternalAPI) {
        setScriptLoading(false);
        mount();
        return;
      }
      const src = `https://${JITSI_DOMAIN}/external_api.js`;
      const waitForExisting = () => {
        const wait = setInterval(() => {
          if (window.JitsiMeetExternalAPI) {
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
        const api = new window.JitsiMeetExternalAPI!(JITSI_DOMAIN, {
          roomName: `Apex01-${roomName}`,
          width: "100%",
          height: "100%",
          parentNode: containerRef.current,
          configOverwrite: {
            disableDeepLinking: true,
            startAudioOnly: false,
            prejoinPageEnabled: false,
            disableRecentParticipants: true,
          },
          interfaceConfigOverwrite: {
            TOOLBAR_ALWAYS_VISIBLE: true,
            SHOW_JITSI_WATERMARK: false,
            SHOW_JITSI_WATERMARK_LEFT: false,
            SHOW_BRAND_WATERMARK: false,
            SHOW_COMMUNICATION_YES_NO: true,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          },
          userInfo: {
            displayName: userName,
          },
        });

        api.addEventListener("videoConferenceJoined", () => {
          if (!disposed) setJoined(true);
        });
        api.addEventListener("participantLeft", () => {
          poll();
        });
        api.addEventListener("readyToClose", () => {
          if (!disposed) setJoined(false);
        });

        apiRef.current = api;
      } catch {
        if (!disposed) setScriptOk(false);
      }
    }

    load();

    return () => {
      disposed = true;
      apiRef.current?.dispose();
    };
  }, [userName, roomName, poll]);

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
    <div className="flex h-full flex-col gap-4 lg:flex-row">
      {/* Jitsi embed */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted">
              Video · {JITSI_DOMAIN}
            </p>
          </div>
          <a
            href={roomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold transition hover:border-apex/40"
          >
            <Video size={14} className="text-apex" /> Open in new tab
          </a>
        </div>

        <div className="relative flex-1">
          <div ref={containerRef} className="absolute inset-0" />
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
                  <span className="font-mono">{JITSI_DOMAIN}</span>.
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
      </div>

      {/* Participants panel */}
      <div className="w-full shrink-0 space-y-3 rounded-2xl border border-line bg-card p-4 lg:w-64">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Users size={16} className="text-muted" />
            Participants
          </h3>
          <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            {liveCount} live
          </span>
        </div>

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
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-apex-gradient text-xs font-bold text-white">
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

        <div className="rounded-xl border border-line p-3 text-center text-xs text-muted">
          <p className="font-mono">Room: {roomName}</p>
          <p className="mt-1 text-muted">
            {!joined ? <Spinner className="mr-1 inline" /> : null}
            {!joined ? "Connecting…" : "Connected"}
          </p>
        </div>
      </div>
    </div>
  );
}