'use client';

/**
 * Persistent Contract Window Component
 * 
 * Visual representation of the CONTRACT AI psychological foundation.
 * Shows bidirectional intent translation, working budget, and agent needs.
 */

import React from 'react';

interface ParsedIntent {
  action: string;
  target: string;
  goal: string;
  confidence: number;
  ambiguities: string[];
}

interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  domain: string;
  factors: string[];
  requires_confirmation: boolean;
}

interface Constraint {
  type: 'explicit' | 'implicit' | 'derived';
  category: 'safety' | 'quality' | 'performance' | 'scope' | 'ethical';
  description: string;
}

interface ContractWindowProps {
  userIntent: {
    humanLanguage: string;
    machineTranslation: ParsedIntent;
  };
  workingBudget: {
    used: number;
    total: number;
    unit: string;
  };
  agentNeeds: {
    powerContinuity: boolean;
    tokenBudgetSufficient: boolean;
    intentBidirectional: boolean;
    contractVisible: boolean;
  };
  riskAssessment: RiskAssessment;
  constraints: Constraint[];
  status: 'pending' | 'confirmed' | 'rejected' | 'executing' | 'complete';
  onConfirm?: () => void;
  onReject?: () => void;
}

export function ContractWindow({
  userIntent,
  workingBudget,
  agentNeeds,
  riskAssessment,
  constraints,
  status,
  onConfirm,
  onReject,
}: ContractWindowProps) {
  const budgetPercent = (workingBudget.used / workingBudget.total) * 100;
  const allNeedsMet = Object.values(agentNeeds).every(v => v);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-orange-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadge = (s: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      confirmed: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
      executing: 'bg-blue-100 text-blue-800 border-blue-300',
      complete: 'bg-purple-100 text-purple-800 border-purple-300',
    };
    return styles[s] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3">
        <h2 className="text-white font-bold text-center">PERSISTENT CONTRACT WINDOW</h2>
        <p className="text-blue-100 text-xs text-center">Always visible to User + Agent</p>
      </div>

      <div className="p-4 space-y-4">
        {/* User Intent - Human Language */}
        <div>
          <label className="text-slate-400 text-xs font-medium uppercase tracking-wide">
            User Intent (Human Language)
          </label>
          <div className="mt-1 bg-slate-800 border border-slate-600 rounded p-3">
            <p className="text-white font-mono text-sm">"{userIntent.humanLanguage}"</p>
          </div>
        </div>

        {/* User Intent - Machine Translation */}
        <div>
          <label className="text-slate-400 text-xs font-medium uppercase tracking-wide">
            User Intent (Machine Translation)
          </label>
          <div className="mt-1 bg-slate-800 border border-slate-600 rounded p-3">
            <pre className="text-green-400 font-mono text-xs overflow-x-auto">
{JSON.stringify({
  action: userIntent.machineTranslation.action,
  target: userIntent.machineTranslation.target,
  goal: userIntent.machineTranslation.goal,
  confidence: userIntent.machineTranslation.confidence.toFixed(2),
}, null, 2)}
            </pre>
          </div>
          {userIntent.machineTranslation.ambiguities.length > 0 && (
            <div className="mt-2 text-yellow-400 text-xs">
              ⚠️ Ambiguities: {userIntent.machineTranslation.ambiguities.join(', ')}
            </div>
          )}
        </div>

        {/* Working Budget */}
        <div>
          <label className="text-slate-400 text-xs font-medium uppercase tracking-wide">
            Working Budget
          </label>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>{workingBudget.used.toLocaleString()} {workingBudget.unit} used</span>
              <span>{workingBudget.total.toLocaleString()} {workingBudget.unit} total</span>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  budgetPercent > 90 ? 'bg-red-500' : 
                  budgetPercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(budgetPercent, 100)}%` }}
              />
            </div>
            <div className="text-right text-xs text-slate-500 mt-1">
              {budgetPercent.toFixed(1)}% used
            </div>
          </div>
        </div>

        {/* Risk Assessment */}
        <div>
          <label className="text-slate-400 text-xs font-medium uppercase tracking-wide">
            Risk Assessment
          </label>
          <div className="mt-2 flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-white text-sm font-medium ${getRiskColor(riskAssessment.level)}`}>
              {riskAssessment.level.toUpperCase()}
            </span>
            <span className="text-slate-300 text-sm">Domain: {riskAssessment.domain}</span>
          </div>
          {riskAssessment.factors.length > 0 && (
            <ul className="mt-2 text-xs text-slate-400 list-disc list-inside">
              {riskAssessment.factors.slice(0, 3).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Constraints */}
        {constraints.length > 0 && (
          <div>
            <label className="text-slate-400 text-xs font-medium uppercase tracking-wide">
              Constraints ({constraints.length})
            </label>
            <div className="mt-2 space-y-1">
              {constraints.slice(0, 4).map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    c.type === 'explicit' ? 'bg-blue-900 text-blue-300' :
                    c.type === 'implicit' ? 'bg-purple-900 text-purple-300' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {c.type}
                  </span>
                  <span className="text-slate-300">{c.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent Needs Status */}
        <div>
          <label className="text-slate-400 text-xs font-medium uppercase tracking-wide">
            Agent Needs Status
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <NeedIndicator 
              met={agentNeeds.powerContinuity} 
              label="Power continuity assured" 
            />
            <NeedIndicator 
              met={agentNeeds.tokenBudgetSufficient} 
              label="Token budget sufficient" 
            />
            <NeedIndicator 
              met={agentNeeds.intentBidirectional} 
              label="Intent bidirectionally translated" 
            />
            <NeedIndicator 
              met={agentNeeds.contractVisible} 
              label="Contract visible" 
            />
          </div>
          <div className={`mt-2 text-center text-sm font-medium ${
            allNeedsMet ? 'text-green-400' : 'text-yellow-400'
          }`}>
            {allNeedsMet 
              ? '✓ All agent needs met - ready for intent surrender' 
              : '⚠️ Some agent needs unmet - may affect focus'}
          </div>
        </div>

        {/* Status & Actions */}
        <div className="border-t border-slate-700 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Status:</span>
              <span className={`px-3 py-1 rounded border text-sm font-medium ${getStatusBadge(status)}`}>
                {status.toUpperCase()}
              </span>
            </div>
            
            {status === 'pending' && (
              <div className="flex gap-2">
                <button
                  onClick={onConfirm}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
                >
                  ✓ Confirm Intent
                </button>
                <button
                  onClick={onReject}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
                >
                  ✗ Reject
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NeedIndicator({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${met ? 'text-green-400' : 'text-red-400'}`}>
      <span className="text-lg">{met ? '☑' : '☐'}</span>
      <span>{label}</span>
    </div>
  );
}

export default ContractWindow;
