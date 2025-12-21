"use client";

import { useEffect, useState } from "react";
import { Toast } from "../components/ui/Toast";

interface RouterMetrics {
  summary: {
    totalMetrics: number;
    routerMetrics: number;
    coverage: number;
  };
  methodDistribution: Array<{
    method: string;
    count: number;
    percentage: number;
  }>;
  latency: Record<string, {
    avg: number;
    min: number;
    max: number;
    p95: number;
  }>;
  confidence: Record<string, {
    avg: number;
    min: number;
    max: number;
  }>;
  cost: Record<string, number>;
  recent: Array<{
    id: string;
    timestamp: string;
    method: string;
    confidence: number;
    latency?: number;
    mode: string;
    platform: string;
  }>;
}

export default function RouterMetricsPage() {
  const [metrics, setMetrics] = useState<RouterMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [rules, setRules] = useState<
    Array<{ mode: string; triggers: string[]; keywords: string[]; length: number }>
  >([]);
  const [ruleActionError, setRuleActionError] = useState<string | null>(null);
  const [undoToken, setUndoToken] = useState<string | null>(null);
  const [undoExpiresAt, setUndoExpiresAt] = useState<number | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<Array<{ id: string; label?: string; createdAt: number }>>([]);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [undoTotalSeconds, setUndoTotalSeconds] = useState<number | null>(null);

  const fetchMetrics = async () => {
    try {
      const response = await fetch("/api/router-metrics");
      if (!response.ok) {
        throw new Error("Failed to fetch metrics");
      }
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchRules();
  }, []);

  useEffect(() => {
    if (undoExpiresAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, undoExpiresAt - Date.now());
        setUndoCountdown(Math.ceil(remaining / 1000));
        if (remaining <= 0) {
          clearInterval(interval);
          setUndoToken(null);
          setUndoExpiresAt(null);
          setUndoCountdown(null);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [undoExpiresAt]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchRules = async () => {
    setRulesLoading(true);
    try {
      const response = await fetch("/api/mode-rules");
      if (!response.ok) {
        throw new Error("Failed to fetch mode rules");
      }
      const data = await response.json();
      setRules(data.rules || []);
      setSnapshots(data.snapshots || []);
      setRuleActionError(null);
    } catch (err) {
      setRuleActionError(err instanceof Error ? err.message : "Failed to load mode rules");
    } finally {
      setRulesLoading(false);
    }
  };

  const softDeleteRule = async (mode: string) => {
    try {
      const response = await fetch("/api/mode-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", mode, ttlMs: 8000 }),
      });
      if (!response.ok) throw new Error("Delete failed");
      const data = await response.json();
      setRules(data.rules || []);
      setUndoToken(data.token?.id || null);
      setUndoExpiresAt(data.token?.expiresAt || null);
      setUndoCountdown(data.token?.expiresAt ? Math.ceil((data.token.expiresAt - Date.now()) / 1000) : null);
      setUndoTotalSeconds(data.token?.expiresAt ? Math.ceil((data.token.expiresAt - Date.now()) / 1000) : null);
      setToastOpen(Boolean(data.token?.id));
      setRuleActionError(null);
    } catch (err) {
      setRuleActionError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const undoDelete = async () => {
    if (!undoToken) return;
    try {
      const response = await fetch("/api/mode-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "undo", tokenId: undoToken }),
      });
      if (!response.ok) throw new Error("Undo failed");
      const data = await response.json();
      setRules(data.rules || []);
      setUndoToken(null);
      setUndoExpiresAt(null);
      setUndoCountdown(null);
      setUndoTotalSeconds(null);
      setToastOpen(false);
      setRuleActionError(null);
    } catch (err) {
      setRuleActionError(err instanceof Error ? err.message : "Undo failed");
    }
  };

  const fetchSnapshots = async () => {
    try {
      const response = await fetch("/api/mode-rules?action=snapshots");
      if (!response.ok) throw new Error("Failed to load snapshots");
      const data = await response.json();
      setSnapshots(data.snapshots || []);
      setSnapshotError(null);
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : "Failed to load snapshots");
    }
  };

  const restoreSnapshot = async (id: string) => {
    try {
      const response = await fetch("/api/mode-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restoreSnapshot", id }),
      });
      if (!response.ok) throw new Error("Restore failed");
      const data = await response.json();
      setRules(data.rules || []);
      await fetchSnapshots();
      setSnapshotError(null);
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : "Restore failed");
    }
  };

  const createSnapshot = async () => {
    try {
      const labelToUse = snapshotLabel || `Snapshot ${new Date().toLocaleString()}`;
      const response = await fetch("/api/mode-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createSnapshot", label: labelToUse }),
      });
      if (!response.ok) throw new Error("Snapshot create failed");
      const data = await response.json();
      setSnapshots(data.snapshots || []);
      setSnapshotLabel("");
      setSnapshotError(null);
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : "Snapshot create failed");
    }
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toFixed(decimals);
  };

  const formatTime = (ms: number) => {
    if (ms < 1) return `${formatNumber(ms * 1000)}μs`;
    if (ms < 1000) return `${formatNumber(ms)}ms`;
    return `${formatNumber(ms / 1000)}s`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      prefix: "bg-blue-100 text-blue-800 border-blue-200",
      semantic: "bg-purple-100 text-purple-800 border-purple-200",
      keyword: "bg-green-100 text-green-800 border-green-200",
      fallback: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[method] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="animate-pulse text-xl text-gray-400">Loading router metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-xl mb-4">Error loading metrics</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-xl mb-2">No metrics available</p>
          <p className="text-sm">Router metrics will appear here once data is collected.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto p-8 pt-0">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Router Performance Dashboard
            </h1>
            <p className="text-gray-500 text-lg">
              Real-time monitoring of semantic mode router performance
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-600">Auto-refresh</span>
            </label>
            <button
              onClick={fetchMetrics}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Total Metrics
            </h3>
            <p className="text-3xl font-bold text-gray-900">{metrics.summary.totalMetrics}</p>
            <p className="text-sm text-gray-500 mt-1">
              {metrics.summary.routerMetrics} with router data
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Router Coverage
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {formatNumber(metrics.summary.coverage)}%
            </p>
            <p className="text-sm text-gray-500 mt-1">of metrics include router data</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Total Cost
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(
                Object.values(metrics.cost).reduce((sum, cost) => sum + cost, 0)
              )}
            </p>
            <p className="text-sm text-gray-500 mt-1">across all router methods</p>
          </div>
        </div>

        {/* Method Distribution */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Method Distribution</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {metrics.methodDistribution.map((method) => (
              <div
                key={method.method}
                className={`border-2 rounded-lg p-4 ${getMethodColor(method.method)}`}
              >
                <div className="text-sm font-semibold uppercase mb-1">{method.method}</div>
                <div className="text-2xl font-bold mb-1">{method.count}</div>
                <div className="text-xs opacity-75">{formatNumber(method.percentage)}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Latency */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Latency by Method</h2>
            <div className="space-y-4">
              {Object.entries(metrics.latency).map(([method, stats]) => (
                <div key={method} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold capitalize">{method}</span>
                    <span className="text-sm text-gray-500">
                      Avg: {formatTime(stats.avg)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                    <div>Min: {formatTime(stats.min)}</div>
                    <div>Max: {formatTime(stats.max)}</div>
                    <div>P95: {formatTime(stats.p95)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Confidence */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Confidence Scores</h2>
            <div className="space-y-4">
              {Object.entries(metrics.confidence).map(([method, stats]) => (
                <div key={method} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold capitalize">{method}</span>
                    <span className="text-sm text-gray-500">
                      Avg: {formatNumber(stats.avg * 100)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>Min: {formatNumber(stats.min * 100)}%</div>
                    <div>Max: {formatNumber(stats.max * 100)}%</div>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${stats.avg * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cost Analysis */}
        {Object.keys(metrics.cost).length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Cost by Method</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Object.entries(metrics.cost)
                .sort(([, a], [, b]) => b - a)
                .map(([method, cost]) => (
                  <div
                    key={method}
                    className="border-2 rounded-lg p-4 border-gray-200"
                  >
                    <div className="text-sm font-semibold uppercase mb-1 text-gray-600">
                      {method}
                    </div>
                    <div className="text-xl font-bold text-gray-900">{formatCurrency(cost)}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Recent Metrics */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Recent Router Activity</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Time
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Method
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Confidence
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Latency
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Mode
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Platform
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.recent.map((metric) => (
                  <tr key={metric.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(metric.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${getMethodColor(
                          metric.method
                        )}`}
                      >
                        {metric.method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {formatNumber(metric.confidence * 100)}%
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {metric.latency ? formatTime(metric.latency) : "—"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 capitalize">
                      {metric.mode}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">{metric.platform}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {metrics.recent.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No recent router activity
              </div>
            )}
          </div>
        </div>

        {/* Mode Rules Recovery */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Mode Rules Recovery</h2>
              <p className="text-gray-500 text-sm">
                Soft-delete rules with an inline undo window to prevent accidental loss.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={createSnapshot}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Snapshot now
              </button>
              <button
                onClick={fetchRules}
                className="px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Refresh rules
              </button>
            </div>
          </div>

          {ruleActionError && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
              {ruleActionError}
            </div>
          )}

          {undoToken && (
            <div className="mb-4 flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">
              <div className="text-sm">
                Undo available for recent delete. Token: {undoToken}
                {undoExpiresAt && (
                  <span className="ml-2 text-xs text-amber-700">
                    expires at {new Date(undoExpiresAt).toLocaleTimeString()}
                  </span>
                )}
                {undoCountdown !== null && (
                  <span className="ml-2 text-xs text-amber-700">
                    ({undoCountdown}s left)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={undoDelete}
                  className="px-3 py-1 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
                >
                  Undo
                </button>
                <button
                  onClick={() => {
                    setUndoToken(null);
                    setUndoExpiresAt(null);
                    setUndoCountdown(null);
                    setUndoTotalSeconds(null);
                    setToastOpen(false);
                  }}
                  className="px-2 py-1 text-sm text-amber-800 hover:text-amber-900"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {snapshotError && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
              {snapshotError}
            </div>
          )}

          <div className="overflow-hidden border border-gray-100 rounded-lg">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Triggers</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Keywords</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Length</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rulesLoading ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500 text-sm" colSpan={5}>
                      Loading rules...
                    </td>
                  </tr>
                ) : rules.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500 text-sm" colSpan={5}>
                      No rules found.
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => (
                    <tr key={rule.mode}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 uppercase">{rule.mode}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{rule.triggers.join(", ") || "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{rule.keywords.join(", ") || "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{rule.length} chars</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => softDeleteRule(rule.mode)}
                          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                        >
                          Soft delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Snapshots</h3>
                <p className="text-sm text-gray-500">Restore previous checkpoints for mode rules.</p>
              </div>
              <button
                onClick={fetchSnapshots}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Refresh snapshots
              </button>
            </div>
            {snapshots.length === 0 ? (
              <div className="text-sm text-gray-500">No snapshots available.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="border border-gray-100 rounded-lg p-3 bg-gray-50 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{snap.label || 'Snapshot'}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(snap.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => restoreSnapshot(snap.id)}
                      className="px-3 py-1 text-xs bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
                placeholder="Label (optional)"
                className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              />
              <button
                onClick={createSnapshot}
                className="px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Create snapshot
              </button>
            </div>
          </div>
        </div>
      </div>

      <Toast
        open={toastOpen}
        message={undoToken ? `Mode rule deleted. Token: ${undoToken}` : "Mode rule deleted."}
        actionLabel={undoToken ? "Undo" : undefined}
        onAction={undoToken ? undoDelete : undefined}
        onClose={() => {
          setToastOpen(false);
          setUndoToken(null);
          setUndoExpiresAt(null);
          setUndoCountdown(null);
          setUndoTotalSeconds(null);
        }}
        variant="warning"
        countdownSeconds={undoCountdown ?? undefined}
        countdownTotalSeconds={undoTotalSeconds ?? undefined}
      />
    </div>
  );
}
