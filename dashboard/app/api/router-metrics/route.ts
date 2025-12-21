import { NextResponse } from 'next/server';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// Calculate paths relative to project root
// Next.js API routes run from the dashboard directory
// We need to go up one level to reach the project root
const getMetricsFile = () => {
  // process.cwd() in Next.js API routes is the dashboard directory
  const currentDir = process.cwd();
  // Go up one level to project root, then to analytics/data
  return join(currentDir, '..', 'analytics', 'data', 'metrics.jsonl');
};

const metricsFile = getMetricsFile();

/**
 * Router Performance Metrics API
 *
 * Returns router performance data including:
 * - Method distribution (prefix, semantic, keyword, fallback)
 * - Average latency by method
 * - Confidence scores
 * - Cost analysis
 */
async function readAllMetrics(): Promise<any[]> {
  try {
    if (!existsSync(metricsFile)) {
      return [];
    }
    const content = await readFile(metricsFile, 'utf-8');
    return content
      .trim()
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  } catch (err) {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    // Read metrics directly from file
    const allMetrics = await readAllMetrics();
    
    // Filter metrics with router data
    const routerMetrics = allMetrics.filter(m => m.router);
    
    // Calculate router statistics
    const methodStats = calculateMethodStats(routerMetrics);
    const latencyStats = calculateLatencyStats(routerMetrics);
    const confidenceStats = calculateConfidenceStats(routerMetrics);
    const costByMethod = calculateCostByMethod(routerMetrics);
    const recentMetrics = routerMetrics
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50); // Last 50 metrics
    
    return NextResponse.json({
      summary: {
        totalMetrics: allMetrics.length,
        routerMetrics: routerMetrics.length,
        coverage: routerMetrics.length > 0 ? (routerMetrics.length / allMetrics.length) * 100 : 0,
      },
      methodDistribution: methodStats,
      latency: latencyStats,
      confidence: confidenceStats,
      cost: costByMethod,
      recent: recentMetrics.map(m => ({
        id: m.id,
        timestamp: m.timestamp,
        method: m.router?.method,
        confidence: m.router?.confidence,
        latency: m.router?.latency,
        mode: m.mode,
        platform: m.platform,
      })),
    });
  } catch (error) {
    console.error('Error fetching router metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch router metrics' },
      { status: 500 }
    );
  }
}

function calculateMethodStats(metrics: any[]) {
  const counts: Record<string, number> = {};
  const total = metrics.length;
  
  for (const metric of metrics) {
    const method = metric.router?.method || 'unknown';
    counts[method] = (counts[method] || 0) + 1;
  }
  
  return Object.entries(counts).map(([method, count]) => ({
    method,
    count,
    percentage: total > 0 ? (count / total) * 100 : 0,
  })).sort((a, b) => b.count - a.count);
}

function calculateLatencyStats(metrics: any[]) {
  const byMethod: Record<string, number[]> = {};
  
  for (const metric of metrics) {
    if (metric.router?.latency !== undefined) {
      const method = metric.router.method;
      if (!byMethod[method]) {
        byMethod[method] = [];
      }
      byMethod[method].push(metric.router.latency);
    }
  }
  
  const stats: Record<string, { avg: number; min: number; max: number; p95: number }> = {};
  
  for (const [method, latencies] of Object.entries(byMethod)) {
    if (latencies.length > 0) {
      const sorted = [...latencies].sort((a, b) => a - b);
      stats[method] = {
        avg: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p95: sorted[Math.floor(sorted.length * 0.95)],
      };
    }
  }
  
  return stats;
}

function calculateConfidenceStats(metrics: any[]) {
  const byMethod: Record<string, number[]> = {};
  
  for (const metric of metrics) {
    if (metric.router?.confidence !== undefined) {
      const method = metric.router.method;
      if (!byMethod[method]) {
        byMethod[method] = [];
      }
      byMethod[method].push(metric.router.confidence);
    }
  }
  
  const stats: Record<string, { avg: number; min: number; max: number }> = {};
  
  for (const [method, confidences] of Object.entries(byMethod)) {
    if (confidences.length > 0) {
      stats[method] = {
        avg: confidences.reduce((sum, c) => sum + c, 0) / confidences.length,
        min: Math.min(...confidences),
        max: Math.max(...confidences),
      };
    }
  }
  
  return stats;
}

function calculateCostByMethod(metrics: any[]) {
  const byMethod: Record<string, number> = {};
  
  for (const metric of metrics) {
    if (metric.cost && metric.router?.method) {
      const method = metric.router.method;
      byMethod[method] = (byMethod[method] || 0) + metric.cost;
    }
  }
  
  return byMethod;
}
