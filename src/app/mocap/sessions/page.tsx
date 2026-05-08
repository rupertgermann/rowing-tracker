"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MocapSessionSummary {
  id: string;
  status: string;
  durationSec: number;
  createdAt: string;
  capturePerspective: string;
  qualityScore: number | null;
  qualityFlags: string[];
  _count: {
    strokePostureMetrics: number;
    postureFaults: number;
  };
}

function statusBadge(status: string) {
  if (status === "ready") return <Badge variant="default">Ready</Badge>;
  if (status === "analyzing") return <Badge variant="secondary">Analyzing…</Badge>;
  if (status === "capturing") return <Badge variant="outline">Capturing</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec.toFixed(0)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MocapSessionsPage() {
  const [sessions, setSessions] = useState<MocapSessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mocap/sessions")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => setSessions(data.sessions))
      .catch((e) => setError(e.message));
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this session? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/mocap/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`${res.status}`);
      setSessions((prev) => prev?.filter((s) => s.id !== id) ?? null);
    } catch (e) {
      alert(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReanalyze(id: string) {
    setReanalyzingId(id);
    try {
      const res = await fetch(`/api/mocap/sessions/${id}/reanalyze`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data: { strokeMetricCount: number; faultCount: number } = await res.json();
      setSessions((prev) =>
        prev?.map((s) =>
          s.id === id
            ? {
                ...s,
                _count: {
                  strokePostureMetrics: data.strokeMetricCount,
                  postureFaults: data.faultCount,
                },
              }
            : s,
        ) ?? null,
      );
    } catch (e) {
      alert(`Reanalyze failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setReanalyzingId(null);
    }
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mocap sessions</h1>
          <p className="text-sm text-muted-foreground">
            All recorded motion capture sessions
          </p>
        </div>
        <Button asChild>
          <Link href="/mocap">New session</Link>
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-red-600">
            Failed to load sessions: {error}
          </CardContent>
        </Card>
      ) : sessions === null ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No sessions yet.{" "}
            <Link href="/mocap" className="underline">
              Record your first session.
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">
                    {fmtDate(s.createdAt)}
                  </CardTitle>
                  {statusBadge(s.status)}
                </div>
                <CardDescription>
                  {s.capturePerspective} · {fmtDuration(s.durationSec)}
                  {s.qualityScore !== null
                    ? ` · quality ${Math.round(s.qualityScore * 100)}%`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>{s._count.strokePostureMetrics} strokes</span>
                    <span>{s._count.postureFaults} faults</span>
                    {s.qualityFlags.length > 0 && (
                      <span className="text-yellow-600">
                        ⚠ {s.qualityFlags.join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {s.status === "ready" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reanalyzingId === s.id}
                          onClick={() => handleReanalyze(s.id)}
                          data-testid={`mocap-reanalyze-${s.id}`}
                        >
                          {reanalyzingId === s.id ? "Analyzing…" : "Reanalyze"}
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/mocap/sessions/${s.id}`}>Replay</Link>
                        </Button>
                      </>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={deletingId === s.id}
                      onClick={() => handleDelete(s.id)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`mocap-delete-${s.id}`}
                    >
                      {deletingId === s.id ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
