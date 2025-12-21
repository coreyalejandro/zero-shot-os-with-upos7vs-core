"use client";

interface Enhancement {
  id: string;
  title: string;
  category: "critical" | "table-stakes" | "value-added";
  status: string;
  priority: number;
  description: string;
  source: string;
  lastUpdated?: string;
}

export default function EnhancementCard({ enhancement }: { enhancement: Enhancement }) {
  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    approved: "bg-blue-100 text-blue-800",
    "in-progress": "bg-yellow-100 text-yellow-800",
    done: "bg-green-100 text-green-800",
  };
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold">{enhancement.title}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[enhancement.status] || statusColors.draft}`}>
          {enhancement.status}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-4">{enhancement.description}</p>
      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>ID: {enhancement.id}</span>
        <span>Priority: {enhancement.priority}</span>
      </div>
      <div className="flex justify-between items-center text-[11px] text-gray-400 mt-2">
        {enhancement.lastUpdated ? (
          <span>Updated: {enhancement.lastUpdated}</span>
        ) : (
          <span />
        )}
        <span>{enhancement.source}</span>
      </div>
    </div>
  );
}
