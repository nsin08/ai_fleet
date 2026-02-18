// ---------------------------------------------------------------------------
// AI Use-Case Port — inbound
// ---------------------------------------------------------------------------

export interface DailySummaryRequest {
  range: 'today' | 'yesterday' | 'last_7d';
}

export interface AiEvidence {
  vehicleId?: string;
  vehicleRegNo?: string;
  eventId?: string;
  alertId?: string;
  ts?: string;
  [key: string]: unknown;
}

export interface DailySummaryResult {
  summaryText: string;
  kpiSnapshot: Record<string, number | string>;
  prioritizedActions: string[];
  evidence: AiEvidence[];
}

export interface ExplainAlertRequest {
  alertId: string;
}

export interface ExplainAlertResult {
  whatHappened: string;
  likelyCauses: string[];
  recommendedActions: string[];
  evidence: AiEvidence[];
}

export interface NextActionsRequest {
  vehicleId?: string;
  vehicleRegNo?: string;
  alertId?: string;
}

export interface NextActionsResult {
  actions: string[];
  evidence: AiEvidence[];
}

export interface ChatRequest {
  message: string;
  contextScope: 'fleet' | 'vehicle';
  vehicleId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ChatResult {
  answer: string;
  evidence: AiEvidence[];
  confidence: 'low' | 'medium' | 'high';
}

export interface AiUseCasePort {
  getDailySummary(req: DailySummaryRequest): Promise<DailySummaryResult>;
  explainAlert(req: ExplainAlertRequest): Promise<ExplainAlertResult>;
  getNextActions(req: NextActionsRequest): Promise<NextActionsResult>;
  chat(req: ChatRequest): Promise<ChatResult>;
}
