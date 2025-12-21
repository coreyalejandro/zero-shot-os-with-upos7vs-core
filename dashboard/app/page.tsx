"use client";

import { useEffect, useState, useMemo } from "react";
import EnhancementCard from "./components/EnhancementCard";
import EnhancementModal from "./components/EnhancementModal";
import { Toast } from "./components/ui/Toast";

interface Enhancement {
  id: string;
  title: string;
  category: "critical" | "table-stakes" | "value-added";
  status: string;
  priority: number;
  description: string;
  content: string;
  source: string;
  lastUpdated?: string;
}

type HandoffApiResponse = {
  content: string;
  lastUpdatedMs?: number;
  statusText?: string | null;
  tests?: { passed: number; total: number; suitesPassed?: number; suitesTotal?: number } | null;
};

type ModeRulesSnapshot = { id: string; label?: string; createdAt: number };

function extractSection(content: string, heading: string): string {
  const start = content.indexOf(heading);
  if (start < 0) return "";
  const after = content.slice(start + heading.length);
  const nextHeadingIdx = after.search(/\n##\s+/);
  if (nextHeadingIdx < 0) return after.trim();
  return after.slice(0, nextHeadingIdx).trim();
}

function summarizeLines(block: string, maxLines: number): string[] {
  return block
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
    .slice(0, maxLines);
}

function sanitizeForCopy(text: string): string {
  return text
    .replace(/\b(sk|pk|tk|ak)-[a-zA-Z0-9]{20,}\b/g, "[REDACTED_KEY]")
    .replace(/\b(api[_-]?key|token)\s*[:=]\s*['"]?[a-zA-Z0-9]{20,}['"]?/gi, "$1: [REDACTED_KEY]")
    .replace(/\bbearer\s+[a-zA-Z0-9._-]{20,}/gi, "bearer [REDACTED_KEY]");
}

export default function DashboardPage() {
  const [enhancements, setEnhancements] = useState<Enhancement[]>([]);
  const [loading, setLoading] = useState(true);
  const [handoffContent, setHandoffContent] = useState<string | null>(null);
  const [handoffMeta, setHandoffMeta] = useState<HandoffApiResponse | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [lastReadMs, setLastReadMs] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<ModeRulesSnapshot[]>([]);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<"info" | "warning" | "error" | "success">("info");

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Modal State
  const [selectedEnhancement, setSelectedEnhancement] = useState<Enhancement | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("handoff:lastReadMs");
      if (stored) {
        const v = Number(stored);
        if (!Number.isNaN(v)) setLastReadMs(v);
      }
    } catch {
      // ignore
    }

    fetch("/api/enhancements")
      .then((res) => res.json())
      .then((data) => {
        setEnhancements(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load enhancements:", err);
        setLoading(false);
      });

    const fetchHandoff = async () => {
      try {
        const res = await fetch("/api/handoff");
        if (!res.ok) {
          throw new Error("Failed to load handoff");
        }
        const data = (await res.json()) as HandoffApiResponse;
        setHandoffMeta(data);
        setHandoffContent(data.content);
        setHandoffError(null);
      } catch (err) {
        setHandoffError(err instanceof Error ? err.message : "Failed to load handoff");
      }
    };
    fetchHandoff();

    const fetchSnapshots = async () => {
      try {
        const res = await fetch("/api/mode-rules");
        if (!res.ok) return;
        const data = await res.json();
        setSnapshots((data.snapshots || []) as ModeRulesSnapshot[]);
      } catch {
        // ignore; panel still works without snapshots
      }
    };
    fetchSnapshots();
  }, []);

  const filteredEnhancements = useMemo(() => {
    return enhancements.filter((e) => {
      const matchesSearch =
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === "all" || e.category === selectedCategory;
      const matchesStatus = selectedStatus === "all" || e.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [enhancements, searchQuery, selectedCategory, selectedStatus]);

  const critical = filteredEnhancements.filter((e) => e.category === "critical");
  const tableStakes = filteredEnhancements.filter((e) => e.category === "table-stakes");
  const valueAdded = filteredEnhancements.filter((e) => e.category === "value-added");

  const latestSnapshot = useMemo(() => {
    if (snapshots.length === 0) return null;
    return [...snapshots].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  }, [snapshots]);

  const isHandoffUpdated = useMemo(() => {
    const updated = handoffMeta?.lastUpdatedMs;
    if (!updated) return false;
    if (!lastReadMs) return true;
    return updated > lastReadMs;
  }, [handoffMeta?.lastUpdatedMs, lastReadMs]);

  const markHandoffRead = () => {
    const updated = handoffMeta?.lastUpdatedMs ?? Date.now();
    setLastReadMs(updated);
    try {
      window.localStorage.setItem("handoff:lastReadMs", String(updated));
    } catch {
      // ignore
    }
  };

  const copyHandoffSummary = async () => {
    if (!handoffContent) return;
    const status = handoffMeta?.statusText ?? "Unknown";
    const updated = handoffMeta?.lastUpdatedMs ? new Date(handoffMeta.lastUpdatedMs).toLocaleString() : "Unknown";
    const tests = handoffMeta?.tests
      ? `${handoffMeta.tests.passed}/${handoffMeta.tests.total}${handoffMeta.tests.suitesTotal ? ` suites:${handoffMeta.tests.suitesTotal}` : ""}`
      : "Unknown";

    const whatChanged = extractSection(handoffContent, "## 📋 What Was Just Completed");
    const nextSteps = extractSection(handoffContent, "## 🎯 Recommended Next Steps");
    const summary = [
      "UPOS-7-VS HANDOFF (sanitized)",
      `Status: ${status}`,
      `Last updated: ${updated}`,
      `Tests: ${tests}`,
      latestSnapshot ? `Latest snapshot: ${latestSnapshot.id}${latestSnapshot.label ? ` (${latestSnapshot.label})` : ""}` : "Latest snapshot: (none)",
      "",
      "What changed:",
      ...summarizeLines(whatChanged, 12),
      "",
      "Next steps:",
      ...summarizeLines(nextSteps, 12),
      "",
      "Links:",
      "- / (Enhancements)",
      "- /analytics",
      "- /router-metrics",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(sanitizeForCopy(summary));
      setToastVariant("success");
      setToastMessage("Copied sanitized handoff summary.");
      setToastOpen(true);
    } catch {
      setToastVariant("error");
      setToastMessage("Copy failed (clipboard permission).");
      setToastOpen(true);
    }
  };

  const restoreLatestSnapshot = async () => {
    if (!latestSnapshot) return;
    setRestoreBusy(true);
    try {
      const res = await fetch("/api/mode-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restoreSnapshot", id: latestSnapshot.id }),
      });
      if (!res.ok) throw new Error("Restore failed");
      setToastVariant("success");
      setToastMessage(`Restored mode rules to snapshot ${latestSnapshot.id}.`);
      setToastOpen(true);
    } catch (err) {
      setToastVariant("error");
      setToastMessage(err instanceof Error ? err.message : "Restore failed");
      setToastOpen(true);
    } finally {
      setRestoreBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="animate-pulse text-xl text-gray-400">Loading knowledge base...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto p-8 pt-0">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            UPOS-7-VS Knowledge Base
          </h1>
          <p className="text-gray-500 text-lg">
            Unified Prompt Operating System Enhancement Tracker
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => setHandoffOpen(true)}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              View Handoff
            </button>
            <button
              onClick={() => (window.location.href = "/analytics")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Analytics
            </button>
            <button
              onClick={() => (window.location.href = "/router-metrics")}
              className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors"
            >
              Router Metrics
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-4 z-10 backdrop-blur-md bg-white/90">
          <div className="relative w-full md:w-96">
            <input
              type="text"
              placeholder="Search enhancements..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex gap-4 w-full md:w-auto">
            <select
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white focus:border-blue-500 outline-none cursor-pointer"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="critical">Critical</option>
              <option value="table-stakes">Table Stakes</option>
              <option value="value-added">Value Added</option>
            </select>

            <select
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white focus:border-blue-500 outline-none cursor-pointer"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gradient-to-br from-red-50 to-white border border-red-100 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-red-800 uppercase tracking-wider mb-1">Critical</h2>
            <p className="text-4xl font-bold text-red-600">{critical.length}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-white border border-yellow-100 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-yellow-800 uppercase tracking-wider mb-1">Table-Stakes</h2>
            <p className="text-4xl font-bold text-yellow-600">{tableStakes.length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-green-800 uppercase tracking-wider mb-1">Value-Added</h2>
            <p className="text-4xl font-bold text-green-600">{valueAdded.length}</p>
          </div>
        </div>

        {/* Content Grid */}
        <div className="space-y-12">
          {critical.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                <span className="w-2 h-8 bg-red-500 rounded-full"></span>
                Critical Priority
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {critical.map((e) => (
                  <div key={e.id} onClick={() => setSelectedEnhancement(e)} className="cursor-pointer">
                    <EnhancementCard enhancement={e} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {tableStakes.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                <span className="w-2 h-8 bg-yellow-500 rounded-full"></span>
                Table Stakes
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tableStakes.map((e) => (
                  <div key={e.id} onClick={() => setSelectedEnhancement(e)} className="cursor-pointer">
                    <EnhancementCard enhancement={e} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {valueAdded.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                <span className="w-2 h-8 bg-green-500 rounded-full"></span>
                Value Added
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {valueAdded.map((e) => (
                  <div key={e.id} onClick={() => setSelectedEnhancement(e)} className="cursor-pointer">
                    <EnhancementCard enhancement={e} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {filteredEnhancements.length === 0 && (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">No enhancements found matching your filters.</p>
              <button
                onClick={() => { setSearchQuery(""); setSelectedCategory("all"); setSelectedStatus("all"); }}
                className="mt-4 text-blue-500 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>

      <EnhancementModal
        isOpen={!!selectedEnhancement}
        onClose={() => setSelectedEnhancement(null)}
        enhancement={selectedEnhancement}
      />

      <Toast
        open={handoffError !== null}
        message={handoffError || ""}
        onClose={() => setHandoffError(null)}
        variant="error"
      />

      <Toast
        open={toastOpen}
        message={toastMessage}
        onClose={() => setToastOpen(false)}
        variant={toastVariant}
      />

      <div
        className={`fixed inset-0 z-40 ${handoffOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!handoffOpen}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${handoffOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setHandoffOpen(false)}
        />
        <div
          className={`absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl transform transition-transform ${
            handoffOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Handoff</p>
              <h2 className="text-2xl font-bold text-gray-900">Project Status</h2>
              {handoffMeta?.lastUpdatedMs && (
                <p className="mt-1 text-xs text-gray-500">
                  Last updated: {new Date(handoffMeta.lastUpdatedMs).toLocaleString()}
                  {isHandoffUpdated && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5">
                      New since read
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyHandoffSummary}
                className="px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Copy summary
              </button>
              <button
                onClick={() => {
                  markHandoffRead();
                  setHandoffOpen(false);
                }}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Mark as read
              </button>
              <button
                onClick={() => setHandoffOpen(false)}
                className="p-2 rounded-md hover:bg-gray-100 text-gray-500"
                aria-label="Close handoff panel"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="p-6 overflow-y-auto h-[calc(100%-72px)]">
            {handoffError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                {handoffError}
              </div>
            )}
            {!handoffError && !handoffContent && (
              <div className="text-gray-500 text-sm">Loading handoff...</div>
            )}
            {handoffContent && (
              <div className="space-y-6">
                {/* Summary block */}
                <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                  <div className="flex flex-col gap-2">
                    <div className="text-sm">
                      <span className="font-semibold text-gray-900">Status:</span>{" "}
                      <span className="text-gray-800">{handoffMeta?.statusText ?? "Unknown"}</span>
                    </div>
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold text-gray-900">Checkpoint:</span>{" "}
                      {latestSnapshot ? (
                        <span className="text-gray-800">
                          {latestSnapshot.id}
                          {latestSnapshot.label ? ` — ${latestSnapshot.label}` : ""}
                        </span>
                      ) : (
                        <span className="text-gray-500">(no snapshots found)</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold text-gray-900">Tests:</span>{" "}
                      {handoffMeta?.tests ? (
                        <span className="text-gray-800">
                          {handoffMeta.tests.passed}/{handoffMeta.tests.total} passing
                        </span>
                      ) : (
                        <span className="text-gray-500">(unknown)</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <a
                        href="/analytics"
                        className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        Analytics
                      </a>
                      <a
                        href="/router-metrics"
                        className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        Router metrics
                      </a>
                      <button
                        onClick={restoreLatestSnapshot}
                        disabled={!latestSnapshot || restoreBusy}
                        className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                        title="Restores the latest mode rules snapshot; other state is unchanged."
                      >
                        {restoreBusy ? "Restoring..." : "Restore mode rules snapshot"}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Restore currently applies to <span className="font-medium">mode rules</span> snapshots only; other state is unchanged.
                    </p>
                  </div>
                </div>

                {/* What changed (collapsible) */}
                <details className="border border-gray-100 rounded-xl p-4 bg-white" open>
                  <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                    What changed (recent)
                  </summary>
                  <div className="mt-3 text-sm text-gray-800 whitespace-pre-wrap">
                    {summarizeLines(extractSection(handoffContent, "## 📋 What Was Just Completed"), 40).join("\n")}
                  </div>
                </details>

                {/* Next steps (collapsible) */}
                <details className="border border-gray-100 rounded-xl p-4 bg-white" open>
                  <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                    Next steps
                  </summary>
                  <div className="mt-3 text-sm text-gray-800 whitespace-pre-wrap">
                    {summarizeLines(extractSection(handoffContent, "## 🎯 Recommended Next Steps"), 60).join("\n")}
                  </div>
                </details>

                {/* Full detail */}
                <details className="border border-gray-100 rounded-xl p-4 bg-white">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                    Full HANDOFF (raw)
                  </summary>
                  <pre className="mt-3 whitespace-pre-wrap text-xs text-gray-700 leading-relaxed">
                    {handoffContent}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
