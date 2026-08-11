export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  status: RunStatus;
  currentRunId?: string;
}

export type RunStatus =
  | 'draft'
  | 'clarifying'
  | 'feasibility_scan'
  | 'planning'
  | 'checking_plan'
  | 'filling_gaps'
  | 'generating_blueprint'
  | 'blueprint_publishing'
  | 'task_packet_gen'
  | 'dispatching_workers'
  | 'workers_running'
  | 'worker_blocked'
  | 'manifest_review'
  | 'blueprint_governor'
  | 'merging'
  | 'conflict_checker'
  | 'planner_review'
  | 'redo_required'
  | 'validating_build'
  | 'qa_running'
  | 'dod_check'
  | 'packaging'
  | 'previewing'
  | 'human_qa'
  | 'ready_for_human_test'
  | 'released'
  | 'failed'
  | 'completed';

export interface FeasibilityReport {
  classification: {
    taskType: 'greenfield_app' | 'new_feature' | 'bug_fix' | 'refactor' | 'optimization' | 'docs' | 'unknown';
    subType?: string;
    confidence: number;
  };
  estimatedComplexity: {
    level: 'simple' | 'moderate' | 'complex' | 'epic';
    estimatedWorkerCount: number;
    estimatedTokens: number;
    estimatedDuration: string;
  };
  capabilityAnalysis: {
    matches: string[];
    gaps: string[];
    recommendations: string[];
  };
  riskAssessment: {
    factors: { level: 'low' | 'medium' | 'high'; description: string }[];
    overallRisk: 'low' | 'medium' | 'high';
  };
  blueprintSuggestions: {
    components: { name: string; type: string; priority: 'core' | 'supporting' | 'optional' }[];
  };
  platformScan: {
    os: string;
    nodeVersion: string;
    availableMemoryMB: number;
    hasGPU: boolean;
  };
}

export type EventType =
  | 'PromptReceived'
  | 'ClarificationRequired'
  | 'PlanDrafted'
  | 'GapDetected'
  | 'BlueprintPublished'
  | 'TaskPacketPublished'
  | 'WorkerStarted'
  | 'WorkerBlocked'
  | 'WorkerDone'
  | 'ManifestPublished'
  | 'ContractChanged'
  | 'BreakingChangeDetected'
  | 'PatchEligible'
  | 'ReplanRequired'
  | 'MergeConflictDetected'
  | 'BuildFailed'
  | 'QAFailed'
  | 'DoDFailed'
  | 'PackageReady'
  | 'HumanQAFailed'
  | 'ReleaseClosed'
  | 'PolicyViolation'
  | 'RiskRaised';

export type ChangeDecision =
  | 'PATCH_LOCAL'
  | 'PATCH_DEPENDENT'
  | 'PATCH_CONTRACT_MINOR'
  | 'REPLAN_SUBSYSTEM'
  | 'REPLAN_GLOBAL'
  | 'ABORT_RUN';

export interface ContractSpec {
  name: string;
  format: string;
  owner: string;
  consumers: string[];
  version: string;
  contentHash: string;
  content: string;
}

export interface BlueprintVersion {
  version: string;
  publishedAt: string;
  mermaidSource: string;
  architecture: string;
  techStack: string;
  workersNeeded: string[];
  contracts: ContractSpec[];
  changeDecision?: ChangeDecision;
}

export interface TaskPacket {
  workerId: string;
  role: string;
  workspace: string[];
  readOnly: string[];
  inputs: string[];
  tasks: string[];
  definitionOfDone: {
    testsRequired: boolean;
    mustCompile: boolean;
    mustNotTouchOutsideWorkspace: boolean;
    customChecks: string[];
  };
  contractsConsumed: string[];
}

export interface ProjectRun {
  id: string;
  projectId: string;
  status: RunStatus;
  prompt: string;
  clarifiedPrompt?: string;
  clarificationQuestions?: string[];
  clarificationAnswers?: Record<string, string>;
  planMarkdown?: string;
  planJson?: PlannerOutput;
  mermaidSource?: string;
  gapReport?: string;
  feasibilityReport?: FeasibilityReport;
  contracts?: ContractSpec[];
  blueprints?: BlueprintVersion[];
  taskPackets?: TaskPacket[];
  changeDecision?: ChangeDecision;
  changeReason?: string;
  workerRuns?: WorkerRun[];
  mergeReport?: {
    success: boolean;
    filesMerged: string[];
    conflicts: string[];
    log: string;
  };
  buildReport?: {
    success: boolean;
    logs: string;
    errors: string[];
  };
  qaReport?: {
    success: boolean;
    testsRun: number;
    testsPassed: number;
    logs: string;
    failures: string[];
  };
  dodReport?: {
    success: boolean;
    checklist: { item: string; checked: boolean; reason: string }[];
  };
  humanQAReport?: {
    passed: boolean;
    feedback: string;
  };
  finalPackageUrl?: string;
  sbomUri?: string;
  attestationUri?: string;
  previewUrl?: string;
  releaseVersion?: string;
  costInputTokens?: number;
  costOutputTokens?: number;
  wallClockSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerOutput {
  architecture: string;
  techStack: string;
  workersNeeded: string[];
  todoList: { id: string; task: string; worker: string; status: 'pending' | 'completed' | 'failed' }[];
  workspaceBoundaries: Record<string, string[]>;
}

export interface WorkerRun {
  workerName: string;
  workerLabel: string;
  status: 'pending' | 'running' | 'blocked' | 'completed' | 'failed';
  modelUsed: string;
  workspace?: string[];
  readOnly?: string[];
  taskPacket?: TaskPacket;
  filesCreated: string[];
  filesModified: string[];
  log: string;
  errorCode?: string;
  contractViolations?: string[];
  manifest?: WorkerManifest;
  cost?: {
    inputTokens: number;
    outputTokens: number;
    wallClockSeconds: number;
  };
}

export interface WorkerManifest {
  workerName: string;
  blueprintVersion: string;
  filesCreated: string[];
  filesModified: string[];
  contractsUsed: string[];
  dependenciesAdded: string[];
  envVarsRequired: string[];
  exportsCreated: string[];
  breakingChanges: string[];
  status: 'completed' | 'failed';
  errorSummary?: string;
  signature?: string;
}

export interface EburonEvent {
  id: string;
  runId: string;
  type: EventType;
  timestamp: string;
  phase: RunStatus;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
  payload?: Record<string, unknown>;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  phase: RunStatus;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

export interface WorkspaceFile {
  path: string;
  content: string;
  owner?: string;
}
