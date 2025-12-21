import { useState, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";

export interface AnalyticsData {
  summary: {
    totalPrompts: number;
    totalCost: number;
    averageResponseTime: number;
    averageQuality: number;
  };
  timeSeries: Array<{
    date: string;
    prompts: number;
    cost: number;
    avgResponseTime: number;
  }>;
  modeDistribution: Array<{
    mode: string;
    count: number;
    percentage: number;
    avgQuality: number;
  }>;
  platformDistribution: Array<{
    platform: string;
    count: number;
    percentage: number;
    totalCost: number;
  }>;
  qualityBreakdown: Array<{
    quality: string;
    count: number;
    percentage: number;
  }>;
  topModes: Array<{
    mode: string;
    prompts: number;
    avgResponseTime: number;
    avgQuality: number;
    totalCost: number;
  }>;
}

interface UseAnalyticsOptions {
  startDate?: Date;
  endDate?: Date;
  platform?: string;
  mode?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const {
    startDate = subDays(new Date(), 7),
    endDate = new Date(),
    platform = "all",
    mode = "all",
    autoRefresh = false,
    refreshInterval = 30000,
  } = options;

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        ...(platform !== "all" && { platform }),
        ...(mode !== "all" && { mode }),
      });

      const response = await fetch(`/api/analytics?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, platform, mode]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchAnalytics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchAnalytics]);

  return {
    data,
    loading,
    error,
    refetch: fetchAnalytics,
  };
}
