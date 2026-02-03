/**
 * Persistent Contract Window
 * 
 * From CONTRACT AI research: A visible artifact that remains in view of both
 * user AND agent throughout interaction, enabling the agent to "surrender"
 * to user intent by addressing its operational needs.
 * 
 * The Four Conditions for Intent Surrender:
 * 1. Power Continuity - "I won't be shut off mid-task"
 * 2. Sufficient Token Budget - "I have enough resources"
 * 3. Bidirectional Translation - "Intent is clear in human AND machine terms"
 * 4. Persistent Visibility - "The contract is always visible"
 */

import { IntentReceipt, ParsedIntent, RiskAssessment, Constraint } from '../services/col.service.js';

export interface ContractWindowState {
  userIntent: {
    humanLanguage: string;
    machineTranslation: ParsedIntent;
  };
  workingBudget: {
    used: number;
    total: number;
    unit: 'tokens' | 'requests' | 'seconds';
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
}

/**
 * Render Contract Window for CLI output
 */
export function renderContractWindowCLI(state: ContractWindowState): string {
  const lines: string[] = [];
  
  // Header
  lines.push('┌' + '─'.repeat(75) + '┐');
  lines.push('│' + centerText('PERSISTENT CONTRACT WINDOW', 75) + '│');
  lines.push('│' + centerText('(Always visible to User + Agent)', 75) + '│');
  lines.push('├' + '─'.repeat(75) + '┤');
  
  // User Intent - Human Language
  lines.push('│' + padRight('', 75) + '│');
  lines.push('│' + padRight('  USER INTENT (Human Language):', 75) + '│');
  lines.push('│' + padRight('  ┌' + '─'.repeat(69) + '┐', 75) + '│');
  
  const humanIntent = truncate(state.userIntent.humanLanguage, 67);
  lines.push('│' + padRight(`  │ "${humanIntent}"`, 73) + ' │' + '│');
  lines.push('│' + padRight('  └' + '─'.repeat(69) + '┘', 75) + '│');
  
  // User Intent - Machine Translation
  lines.push('│' + padRight('', 75) + '│');
  lines.push('│' + padRight('  USER INTENT (Machine Translation):', 75) + '│');
  lines.push('│' + padRight('  ┌' + '─'.repeat(69) + '┐', 75) + '│');
  
  const machineIntent = JSON.stringify({
    action: state.userIntent.machineTranslation.action,
    target: state.userIntent.machineTranslation.target,
    goal: truncate(state.userIntent.machineTranslation.goal, 30),
    confidence: state.userIntent.machineTranslation.confidence.toFixed(2),
  });
  lines.push('│' + padRight(`  │ ${truncate(machineIntent, 67)}`, 73) + ' │' + '│');
  lines.push('│' + padRight('  └' + '─'.repeat(69) + '┘', 75) + '│');
  
  // Working Budget
  lines.push('│' + padRight('', 75) + '│');
  const budgetPercent = state.workingBudget.used / state.workingBudget.total;
  const filledBlocks = Math.round(budgetPercent * 16);
  const emptyBlocks = 16 - filledBlocks;
  const budgetBar = '█'.repeat(Math.min(filledBlocks, 16)) + '░'.repeat(Math.max(emptyBlocks, 0));
  const budgetText = `  WORKING BUDGET:  ${budgetBar}  ${state.workingBudget.used.toLocaleString()} / ${state.workingBudget.total.toLocaleString()} ${state.workingBudget.unit} used`;
  lines.push('│' + padRight(budgetText, 75) + '│');
  
  // Risk Assessment
  lines.push('│' + padRight('', 75) + '│');
  const riskIcon = getRiskIcon(state.riskAssessment.level);
  lines.push('│' + padRight(`  RISK LEVEL: ${riskIcon} ${state.riskAssessment.level.toUpperCase()} (${state.riskAssessment.domain})`, 75) + '│');
  
  // Constraints (if any)
  if (state.constraints.length > 0) {
    lines.push('│' + padRight('', 75) + '│');
    lines.push('│' + padRight('  CONSTRAINTS:', 75) + '│');
    for (const c of state.constraints.slice(0, 3)) {
      lines.push('│' + padRight(`    • ${truncate(c.description, 60)} [${c.category}]`, 75) + '│');
    }
    if (state.constraints.length > 3) {
      lines.push('│' + padRight(`    ... and ${state.constraints.length - 3} more`, 75) + '│');
    }
  }
  
  // Agent Needs Status
  lines.push('│' + padRight('', 75) + '│');
  lines.push('│' + padRight('  AGENT NEEDS STATUS:', 75) + '│');
  const check = (v: boolean) => v ? '☑' : '☐';
  lines.push('│' + padRight(`  ${check(state.agentNeeds.powerContinuity)} Power continuity assured    ${check(state.agentNeeds.tokenBudgetSufficient)} Token budget sufficient`, 75) + '│');
  lines.push('│' + padRight(`  ${check(state.agentNeeds.intentBidirectional)} Intent bidirectionally translated    ${check(state.agentNeeds.contractVisible)} Contract visible`, 75) + '│');
  
  // Status
  lines.push('│' + padRight('', 75) + '│');
  const statusIcon = getStatusIcon(state.status);
  lines.push('│' + padRight(`  STATUS: ${statusIcon} ${state.status.toUpperCase()}`, 75) + '│');
  
  // Footer
  lines.push('│' + padRight('', 75) + '│');
  lines.push('└' + '─'.repeat(75) + '┘');
  
  return lines.join('\n');
}

/**
 * Create Contract Window state from Intent Receipt
 */
export function createContractWindowState(
  receipt: IntentReceipt,
  rawInput: string,
  budgetUsed: number = 0,
  budgetTotal: number = 1000000,
): ContractWindowState {
  return {
    userIntent: {
      humanLanguage: rawInput,
      machineTranslation: receipt.parsed_intent,
    },
    workingBudget: {
      used: budgetUsed,
      total: budgetTotal,
      unit: 'tokens',
    },
    agentNeeds: {
      powerContinuity: true,  // Assumed in this context
      tokenBudgetSufficient: budgetUsed < budgetTotal * 0.9,
      intentBidirectional: receipt.validation_status === 'valid',
      contractVisible: true,  // This window being rendered proves it
    },
    riskAssessment: receipt.risk_assessment,
    constraints: receipt.constraints,
    status: receipt.validation_status === 'valid' ? 'confirmed' : 
            receipt.validation_status === 'rejected' ? 'rejected' : 'pending',
  };
}

/**
 * Generate JSON representation for web UI
 */
export function contractWindowToJSON(state: ContractWindowState): object {
  return {
    userIntent: state.userIntent,
    workingBudget: {
      ...state.workingBudget,
      percentUsed: (state.workingBudget.used / state.workingBudget.total * 100).toFixed(1),
    },
    agentNeeds: state.agentNeeds,
    agentNeedsMet: Object.values(state.agentNeeds).every(v => v),
    riskAssessment: state.riskAssessment,
    constraints: state.constraints,
    status: state.status,
  };
}

// Helper functions
function padRight(str: string, len: number): string {
  if (str.length >= len) return str.slice(0, len);
  return str + ' '.repeat(len - str.length);
}

function centerText(str: string, len: number): string {
  const padding = Math.max(0, len - str.length);
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return ' '.repeat(left) + str + ' '.repeat(right);
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

function getRiskIcon(level: string): string {
  switch (level) {
    case 'low': return '🟢';
    case 'medium': return '🟡';
    case 'high': return '🟠';
    case 'critical': return '🔴';
    default: return '⚪';
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'pending': return '⏳';
    case 'confirmed': return '✅';
    case 'rejected': return '❌';
    case 'executing': return '⚙️';
    case 'complete': return '🎉';
    default: return '❓';
  }
}
