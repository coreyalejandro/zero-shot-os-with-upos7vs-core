"use client";

import ReactMarkdown from "react-markdown";

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

interface EnhancementModalProps {
    isOpen: boolean;
    onClose: () => void;
    enhancement: Enhancement | null;
}

export default function EnhancementModal({ isOpen, onClose, enhancement }: EnhancementModalProps) {
    if (!isOpen || !enhancement) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wider
                ${enhancement.category === 'critical' ? 'bg-red-100 text-red-700' :
                                    enhancement.category === 'table-stakes' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-green-100 text-green-700'}`}>
                                {enhancement.category}
                            </span>
                            <span className="text-xs text-gray-400 font-mono">{enhancement.id}</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">{enhancement.title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="prose prose-slate max-w-none">
                        <ReactMarkdown>{enhancement.content}</ReactMarkdown>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-sm text-gray-500">
                    <div>
                        Source: <code className="bg-gray-200 px-1 py-0.5 rounded">{enhancement.source}</code>
                    </div>
                    {enhancement.lastUpdated && (
                        <div>Updated: {enhancement.lastUpdated}</div>
                    )}
                </div>
            </div>
        </div>
    );
}
