"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { formatCurrency, formatTime, formatNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign, Clock, Star, MessageSquare } from "lucide-react";

interface SummaryCardsProps {
  summary: {
    totalPrompts: number;
    totalCost: number;
    averageResponseTime: number;
    averageQuality: number;
  };
  loading?: boolean;
  previousPeriod?: {
    totalPrompts: number;
    totalCost: number;
    averageResponseTime: number;
    averageQuality: number;
  };
}

export function SummaryCards({ summary, loading, previousPeriod }: SummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return change;
  };

  const cards = [
    {
      title: "Total Prompts",
      value: summary.totalPrompts.toLocaleString(),
      icon: MessageSquare,
      change: previousPeriod
        ? calculateChange(summary.totalPrompts, previousPeriod.totalPrompts)
        : null,
      description: "All prompts processed",
    },
    {
      title: "Total Cost",
      value: formatCurrency(summary.totalCost),
      icon: DollarSign,
      change: previousPeriod
        ? calculateChange(summary.totalCost, previousPeriod.totalCost)
        : null,
      description: "Cumulative API costs",
    },
    {
      title: "Avg Response Time",
      value: formatTime(summary.averageResponseTime),
      icon: Clock,
      change: previousPeriod
        ? calculateChange(
            summary.averageResponseTime,
            previousPeriod.averageResponseTime
          )
        : null,
      description: "Average latency",
    },
    {
      title: "Avg Quality",
      value: `${formatNumber(summary.averageQuality)}/5`,
      icon: Star,
      change: previousPeriod
        ? calculateChange(summary.averageQuality, previousPeriod.averageQuality)
        : null,
      description: "User satisfaction",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isPositive = card.change !== null && card.change > 0;
        const isNegative = card.change !== null && card.change < 0;

        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {card.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                {card.change !== null ? (
                  <>
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : isNegative ? (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    ) : null}
                    <span
                      className={
                        isPositive
                          ? "text-green-600"
                          : isNegative
                          ? "text-red-600"
                          : "text-gray-500"
                      }
                    >
                      {isPositive ? "+" : ""}
                      {formatNumber(Math.abs(card.change))}% from previous period
                    </span>
                  </>
                ) : (
                  <span>{card.description}</span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
