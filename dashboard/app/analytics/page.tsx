"use client";

import { useState } from "react";
import { format, subDays } from "date-fns";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { LoadingState } from "../components/LoadingState";
import { useAnalytics } from "../hooks/useAnalytics";
import { SummaryCards } from "../components/analytics/SummaryCards";
import { TimeSeriesChart } from "../components/analytics/TimeSeriesChart";
import { DistributionCharts } from "../components/analytics/DistributionCharts";
import { Filters } from "../components/analytics/Filters";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs";
import ExportButton from "../components/ExportButton";
import { Download, RefreshCw, Settings } from "lucide-react";
import { formatCurrency, formatTime, formatNumber } from "../lib/utils";

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: subDays(new Date(), 7),
    end: new Date(),
  });
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [selectedMode, setSelectedMode] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data, loading, error, refetch } = useAnalytics({
    startDate: dateRange.start,
    endDate: dateRange.end,
    platform: selectedPlatform,
    mode: selectedMode,
    autoRefresh,
    refreshInterval: 30000,
  });

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error.message}</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Analytics Dashboard
              </h1>
              <p className="text-gray-500 text-lg">
                Comprehensive performance metrics and insights
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Auto-refresh</span>
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                isLoading={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {data && (
                <>
                  <ExportButton data={data} filename="analytics-export" format="json" />
                  <ExportButton data={data.timeSeries} filename="time-series" format="csv" />
                </>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="mb-8">
            <Filters
              startDate={dateRange.start}
              endDate={dateRange.end}
              platform={selectedPlatform}
              mode={selectedMode}
              onStartDateChange={(date) => setDateRange({ ...dateRange, start: date })}
              onEndDateChange={(date) => setDateRange({ ...dateRange, end: date })}
              onPlatformChange={setSelectedPlatform}
              onModeChange={setSelectedMode}
            />
          </div>

          {loading && !data ? (
            <LoadingState />
          ) : !data ? (
            <Card>
              <CardContent className="py-20">
                <div className="text-center text-gray-500">
                  <p className="text-xl mb-2">No analytics data available</p>
                  <p className="text-sm">
                    Analytics will appear here once data is collected.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="mb-8">
                <SummaryCards summary={data.summary} loading={loading} />
              </div>

              {/* Time Series Chart */}
              <div className="mb-8">
                <TimeSeriesChart data={data.timeSeries} loading={loading} />
              </div>

              {/* Distribution Charts */}
              <div className="mb-8">
                <DistributionCharts
                  modeDistribution={data.modeDistribution}
                  platformDistribution={data.platformDistribution}
                  loading={loading}
                />
              </div>

              {/* Quality Breakdown & Top Modes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Quality Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quality Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.qualityBreakdown && data.qualityBreakdown.length > 0 ? (
                      <div className="space-y-4">
                        {data.qualityBreakdown.map((quality) => (
                          <div key={quality.quality} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge
                                variant={
                                  quality.quality === "excellent"
                                    ? "success"
                                    : quality.quality === "good"
                                    ? "default"
                                    : quality.quality === "acceptable"
                                    ? "warning"
                                    : "destructive"
                                }
                              >
                                {quality.quality}
                              </Badge>
                              <span className="text-sm font-medium text-gray-700">
                                {quality.count} ({formatNumber(quality.percentage)}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  quality.quality === "excellent"
                                    ? "bg-green-600"
                                    : quality.quality === "good"
                                    ? "bg-blue-600"
                                    : quality.quality === "acceptable"
                                    ? "bg-yellow-600"
                                    : "bg-red-600"
                                }`}
                                style={{ width: `${quality.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-64 text-gray-500">
                        No quality data available
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top Modes Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Performing Modes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.topModes && data.topModes.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                                Mode
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                                Prompts
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                                Avg Time
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                                Quality
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                                Cost
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.topModes.map((mode) => (
                              <tr
                                key={mode.mode}
                                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                              >
                                <td className="py-3 px-4 text-sm font-medium text-gray-900 capitalize">
                                  {mode.mode}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-700">
                                  {mode.prompts}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-700">
                                  {formatTime(mode.avgResponseTime)}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-700">
                                  {formatNumber(mode.avgQuality)}/5
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-700">
                                  {formatCurrency(mode.totalCost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-64 text-gray-500">
                        No mode data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
