"use client";

import { Card, CardContent } from "../ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/Select";
import { format } from "date-fns";
import { Calendar, Filter } from "lucide-react";

interface FiltersProps {
  startDate: Date;
  endDate: Date;
  platform: string;
  mode: string;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  onPlatformChange: (platform: string) => void;
  onModeChange: (mode: string) => void;
}

export function Filters({
  startDate,
  endDate,
  platform,
  mode,
  onStartDateChange,
  onEndDateChange,
  onPlatformChange,
  onModeChange,
}: FiltersProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-3 w-3 mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={format(startDate, "yyyy-MM-dd")}
              onChange={(e) => onStartDateChange(new Date(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-3 w-3 mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={format(endDate, "yyyy-MM-dd")}
              onChange={(e) => onEndDateChange(new Date(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
            <Select value={platform} onValueChange={onPlatformChange}>
              <SelectTrigger>
                <SelectValue placeholder="All Platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="cursor">Cursor</SelectItem>
                <SelectItem value="chatgpt">ChatGPT</SelectItem>
                <SelectItem value="claude">Claude</SelectItem>
                <SelectItem value="openai-api">OpenAI API</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="watson">Watson</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
            <Select value={mode} onValueChange={onModeChange}>
              <SelectTrigger>
                <SelectValue placeholder="All Modes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="core">Core</SelectItem>
                <SelectItem value="dev">Dev</SelectItem>
                <SelectItem value="uxui">UX/UI</SelectItem>
                <SelectItem value="next">Next.js</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="long">Long</SelectItem>
                <SelectItem value="handoff">Handoff</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
