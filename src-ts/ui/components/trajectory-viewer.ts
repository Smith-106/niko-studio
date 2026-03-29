/**
 * UI Components - Trajectory Viewer
 *
 * Agent reasoning trajectory and decision visualization.
 * Migrated from src/ui/components/trajectory_viewer.py - logic only (no Streamlit).
 */

export interface TrajectoryStep {
  node: string;
  action: string;
  thought?: string;
  result?: Record<string, unknown>;
  timestamp?: string;
  status: 'completed' | 'running' | 'failed' | 'skipped';
}

export interface TrajectoryData {
  title: string;
  steps: TrajectoryStep[];
}

export interface WorkflowProgress {
  currentNode: string;
  nodes: string[];
  completedNodes: string[];
  progressRatio: number;
}

export interface AgentEvent {
  agent: string;
  action: string;
  time?: string;
  details?: string;
}

export interface DecisionPoint {
  question: string;
  options: string[];
  selected: string;
  reason?: string;
}

// --- Trajectory View ---

export function buildTrajectoryData(
  steps: TrajectoryStep[],
  title?: string,
): TrajectoryData {
  return {
    title: title ?? 'Reasoning Trajectory',
    steps,
  };
}

export function getStepIcon(status: TrajectoryStep['status']): string {
  const icons: Record<TrajectoryStep['status'], string> = {
    completed: 'check',
    running: 'loading',
    failed: 'error',
    skipped: 'skip',
  };
  return icons[status] ?? 'pin';
}

export function truncateDraftContent(content: string, maxLen = 500): string {
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen) + '...';
}

// --- Workflow Progress ---

export function buildWorkflowProgress(
  currentNode: string,
  nodes: string[],
  completedNodes: string[],
): WorkflowProgress {
  return {
    currentNode,
    nodes,
    completedNodes,
    progressRatio: nodes.length > 0 ? completedNodes.length / nodes.length : 0,
  };
}

export function getNodeStatus(
  node: string,
  currentNode: string,
  completedNodes: string[],
): 'completed' | 'active' | 'pending' {
  if (completedNodes.includes(node)) return 'completed';
  if (node === currentNode) return 'active';
  return 'pending';
}

// --- Agent Timeline ---

export function formatAgentTimeline(
  events: AgentEvent[],
  maxEvents = 10,
): AgentEvent[] {
  const start = Math.max(0, events.length - maxEvents);
  return events.slice(start).reverse();
}

export function getAgentColor(agent: string): string {
  const colors: Record<string, string> = {
    Architect: 'blue',
    Writer: 'green',
    Critic: 'red',
    Commander: 'purple',
    Human: 'yellow',
  };
  return colors[agent] ?? 'gray';
}

// --- Decision Tree ---

export function buildDecisionTree(decision: DecisionPoint): {
  question: string;
  options: Array<{ label: string; isSelected: boolean }>;
  reason: string | null;
} {
  return {
    question: decision.question,
    options: decision.options.map(opt => ({
      label: opt,
      isSelected: opt === decision.selected,
    })),
    reason: decision.reason ?? null,
  };
}
