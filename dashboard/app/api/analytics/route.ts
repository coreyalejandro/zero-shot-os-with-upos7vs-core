import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { startOfDay, endOfDay, eachDayOfInterval, format } from 'date-fns';

const getMetricsFile = () => {
  const currentDir = process.cwd();
  return join(currentDir, '..', 'analytics', 'data', 'metrics.jsonl');
};

async function readAllMetrics(): Promise<any[]> {
  try {
    const metricsFile = getMetricsFile();
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
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start')
      ? new Date(searchParams.get('start')!)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = searchParams.get('end')
      ? new Date(searchParams.get('end')!)
      : new Date();
    const platformFilter = searchParams.get('platform');
    const modeFilter = searchParams.get('mode');

    const allMetrics = await readAllMetrics();

    // Filter by date range
    let filteredMetrics = allMetrics.filter((m) => {
      const metricDate = new Date(m.timestamp);
      return metricDate >= startOfDay(startDate) && metricDate <= endOfDay(endDate);
    });

    // Filter by platform
    if (platformFilter && platformFilter !== 'all') {
      filteredMetrics = filteredMetrics.filter((m) => m.platform === platformFilter);
    }

    // Filter by mode
    if (modeFilter && modeFilter !== 'all') {
      filteredMetrics = filteredMetrics.filter((m) => m.mode === modeFilter);
    }

    // Calculate summary
    const totalPrompts = filteredMetrics.length;
    const totalCost = filteredMetrics.reduce((sum, m) => sum + (m.cost || 0), 0);
    const averageResponseTime =
      filteredMetrics.length > 0
        ? filteredMetrics.reduce((sum, m) => sum + m.responseTime, 0) / filteredMetrics.length
        : 0;

    const qualityMap: Record<string, number> = {
      excellent: 5,
      good: 4,
      acceptable: 3,
      poor: 2,
    };
    const averageQuality =
      filteredMetrics.length > 0
        ? filteredMetrics.reduce((sum, m) => {
            const quality = m.userRating || qualityMap[m.quality] || 3;
            return sum + quality;
          }, 0) / filteredMetrics.length
        : 0;

    // Time series data
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const timeSeries = days.map((day) => {
      const dayMetrics = filteredMetrics.filter((m) => {
        const metricDate = new Date(m.timestamp);
        return format(metricDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      });
      return {
        date: format(day, 'yyyy-MM-dd'),
        prompts: dayMetrics.length,
        cost: dayMetrics.reduce((sum, m) => sum + (m.cost || 0), 0),
        avgResponseTime:
          dayMetrics.length > 0
            ? dayMetrics.reduce((sum, m) => sum + m.responseTime, 0) / dayMetrics.length
            : 0,
      };
    });

    // Mode distribution
    const modeCounts: Record<string, number> = {};
    const modeQuality: Record<string, number[]> = {};
    filteredMetrics.forEach((m) => {
      modeCounts[m.mode] = (modeCounts[m.mode] || 0) + 1;
      if (!modeQuality[m.mode]) {
        modeQuality[m.mode] = [];
      }
      const quality = m.userRating || qualityMap[m.quality] || 3;
      modeQuality[m.mode].push(quality);
    });

    const modeDistribution = Object.entries(modeCounts)
      .map(([mode, count]) => ({
        mode,
        count,
        percentage: totalPrompts > 0 ? (count / totalPrompts) * 100 : 0,
        avgQuality:
          modeQuality[mode] && modeQuality[mode].length > 0
            ? modeQuality[mode].reduce((sum, q) => sum + q, 0) / modeQuality[mode].length
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Platform distribution
    const platformCounts: Record<string, number> = {};
    const platformCost: Record<string, number> = {};
    filteredMetrics.forEach((m) => {
      platformCounts[m.platform] = (platformCounts[m.platform] || 0) + 1;
      platformCost[m.platform] = (platformCost[m.platform] || 0) + (m.cost || 0);
    });

    const platformDistribution = Object.entries(platformCounts)
      .map(([platform, count]) => ({
        platform,
        count,
        percentage: totalPrompts > 0 ? (count / totalPrompts) * 100 : 0,
        totalCost: platformCost[platform] || 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Quality breakdown
    const qualityCounts: Record<string, number> = {};
    filteredMetrics.forEach((m) => {
      qualityCounts[m.quality] = (qualityCounts[m.quality] || 0) + 1;
    });

    const qualityBreakdown = Object.entries(qualityCounts)
      .map(([quality, count]) => ({
        quality,
        count,
        percentage: totalPrompts > 0 ? (count / totalPrompts) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Top modes
    const topModes = modeDistribution
      .map((mode) => {
        const modeMetrics = filteredMetrics.filter((m) => m.mode === mode.mode);
        return {
          mode: mode.mode,
          prompts: mode.count,
          avgResponseTime:
            modeMetrics.length > 0
              ? modeMetrics.reduce((sum, m) => sum + m.responseTime, 0) / modeMetrics.length
              : 0,
          avgQuality: mode.avgQuality,
          totalCost: modeMetrics.reduce((sum, m) => sum + (m.cost || 0), 0),
        };
      })
      .sort((a, b) => b.prompts - a.prompts)
      .slice(0, 10);

    return NextResponse.json({
      summary: {
        totalPrompts,
        totalCost,
        averageResponseTime,
        averageQuality,
      },
      timeSeries,
      modeDistribution,
      platformDistribution,
      qualityBreakdown,
      topModes,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
