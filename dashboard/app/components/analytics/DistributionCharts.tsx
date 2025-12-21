"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const MODE_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#06b6d4", // cyan
];

interface DistributionChartsProps {
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
  loading?: boolean;
}

export function DistributionCharts({
  modeDistribution,
  platformDistribution,
  loading,
}: DistributionChartsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Mode Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Mode Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {modeDistribution && modeDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={modeDistribution}
                  dataKey="count"
                  nameKey="mode"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry: any) => `${entry.mode}: ${entry.percentage.toFixed(1)}%`}
                >
                  {modeDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={MODE_COLORS[index % MODE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No mode data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {platformDistribution && platformDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={platformDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                <XAxis dataKey="platform" className="text-xs" stroke="#6b7280" />
                <YAxis className="text-xs" stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar dataKey="count" fill="#3b82f6" name="Prompts" radius={[8, 8, 0, 0]} />
                <Bar dataKey="totalCost" fill="#10b981" name="Cost ($)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No platform data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
