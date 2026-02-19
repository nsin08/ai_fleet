/* Shared TypeScript interfaces matching the API response shapes */

export interface Vehicle {
  id: string;
  vehicleRegNo: string;
  name: string;
  vehicleType: string;
  depotId: string;
  status: string;
  isActive: boolean;
  assignedDriverId?: string;
}

export interface VehicleDetail extends Vehicle {
  latestTelemetry?: TelemetryPoint[];
  openAlerts?: Alert[];
  recentEvents?: FleetEvent[];
  currentTrip?: TripSummary | null;
  previousTrips?: TripSummary[];
}

export type DriverAvailabilityStatus = 'available' | 'on_trip' | 'off_shift' | 'leave';
export type DriverRiskBand = 'low' | 'medium' | 'high';

export interface DriverSummary {
  id: string;
  name: string;
  licenseId: string;
  phone?: string;
  baseSafetyScore: number;
  currentSafetyScore: number;
  availabilityStatus: DriverAvailabilityStatus;
  shiftStartLocal?: string;
  shiftEndLocal?: string;
  availabilityUpdatedAt?: string;
  isActive: boolean;
  riskBand: DriverRiskBand;
  isAssignable: boolean;
  activeTripCount: number;
  currentTripId?: string;
  currentVehicleId?: string;
  currentVehicleRegNo?: string;
  currentTripStartedAt?: string;
  openAlertCount: number;
  lastTripAt?: string;
}

export interface DriverScorePoint {
  ts: string;
  score: number;
}

export interface DriverProfile extends DriverSummary {
  scoreTrend: DriverScorePoint[];
  currentTrip?: TripSummary | null;
  recentTrips: TripSummary[];
  recentAlerts: Alert[];
  recentEvents: FleetEvent[];
}

export interface DriverScoreSnapshot {
  driverId: string;
  baseSafetyScore: number;
  currentSafetyScore: number;
  delta: number;
  riskBand: DriverRiskBand;
  availabilityStatus: DriverAvailabilityStatus;
  isAssignable: boolean;
  scoreTrend: DriverScorePoint[];
}

export type WorkOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type WorkOrderStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type MaintenanceUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface MaintenancePlanSummary {
  id: string;
  vehicleId: string;
  vehicleRegNo?: string;
  vehicleType?: string;
  intervalKm: number;
  intervalDays: number;
  lastServiceAt?: string;
  lastServiceOdometerKm?: number;
  nextDueDate: string;
  nextDueOdometerKm: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  currentOdometerKm?: number;
  kmRemaining?: number;
  daysRemaining?: number;
  urgency?: MaintenanceUrgency;
}

export interface WorkOrderSummary {
  id: string;
  vehicleId: string;
  vehicleRegNo?: string;
  maintenancePlanId?: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  title: string;
  description?: string;
  openedAt: string;
  startedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  openedBy?: string;
  assignedTo?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderDetail extends WorkOrderSummary {}

export type FuelAnomalyStatus = 'OPEN' | 'CONFIRMED' | 'DISMISSED' | 'RESOLVED';
export type FuelAnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface FuelAnomalySummary {
  id: string;
  vehicleId: string;
  vehicleRegNo?: string;
  tripId?: string;
  depotId?: string;
  depotName?: string;
  eventType: 'consumption' | 'refuel' | 'anomaly';
  severity: FuelAnomalySeverity;
  fuelDeltaPct: number;
  estimatedLiters?: number;
  anomalyScore?: number;
  status: FuelAnomalyStatus;
  evidence?: Record<string, unknown>;
  dispositionNote?: string;
  dispositionedBy?: string;
  dispositionedAt?: string;
  ts: string;
  createdAt: string;
  updatedAt: string;
}

export interface FuelAnomalyStats {
  total: number;
  open: number;
  confirmed: number;
  dismissed: number;
  resolved: number;
  highRiskOpen: number;
}

export interface FuelAnomalyListResponse {
  data: FuelAnomalySummary[];
  total: number;
  stats: FuelAnomalyStats;
}

export interface CostTrendPoint {
  day: string;
  totalCost: number;
  distanceKm: number;
  idleCost: number;
  costPerKm: number;
  idleCostRatio: number;
}

export interface CostSummary {
  totalCost: number;
  totalDistanceKm: number;
  costPerKm: number;
  idleCost: number;
  idleCostRatio: number;
  fuelCost: number;
  maintenanceCost: number;
  driverCost: number;
  tollCost: number;
  otherCost: number;
  entryCount: number;
  tripCount: number;
  trend: CostTrendPoint[];
}

export interface VehicleCostSummary {
  vehicleId: string;
  vehicleRegNo: string;
  vehicleType: string;
  depotId?: string;
  depotName?: string;
  totalCost: number;
  totalDistanceKm: number;
  costPerKm: number;
  idleCost: number;
  idleCostRatio: number;
  fuelCost: number;
  maintenanceCost: number;
  driverCost: number;
  tollCost: number;
  otherCost: number;
  tripCount: number;
  lastEntryAt?: string;
}

export interface TelemetryPoint {
  id: number;
  vehicleId: string;
  vehicleRegNo: string;
  tripId?: string;
  scenarioRunId?: string;
  sourceMode: 'replay' | 'live';
  sourceEmitterId?: string;
  ts: string;
  tsEpochMs: number;
  lat: number;
  lng: number;
  speedKph: number;
  ignition: boolean;
  idling: boolean;
  fuelPct: number;
  engineTempC?: number;
  batteryV?: number;
  odometerKm: number;
  headingDeg?: number;
  rpm?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface FleetEvent {
  id: string;
  ts: string;
  vehicleId: string;
  vehicleRegNo: string;
  driverId?: string;
  tripId?: string;
  scenarioRunId?: string;
  sourceMode: 'replay' | 'live';
  sourceEmitterId?: string;
  source: string;
  eventType: string;
  severity: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Alert {
  closureReason?: AlertClosureReason;
  id: string;
  createdTs: string;
  updatedTs: string;
  closedTs?: string;
  vehicleId: string;
  vehicleRegNo: string;
  driverId?: string;
  tripId?: string;
  scenarioRunId?: string;
  alertType: string;
  severity: string;
  status: 'OPEN' | 'ACK' | 'CLOSED';
  title: string;
  description: string;
  evidence?: Record<string, unknown>;
  relatedEventIds?: string[];
  acknowledgedBy?: string;
  acknowledgedTs?: string;
  note?: string;
  ownerUserId?: string;
  ownerDisplayName?: string;
  slaDueTs?: string;
  escalationLevel?: number;
  escalationState?: 'ON_TRACK' | 'AT_RISK' | 'OVERDUE';
  assignedBy?: string;
  assignedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type AlertClosureReason =
  | 'resolved_by_driver'
  | 'resolved_by_ops'
  | 'maintenance_action'
  | 'false_positive'
  | 'duplicate_alert'
  | 'other';

export type AiEvidenceRefType =
  | 'page'
  | 'alert'
  | 'vehicle'
  | 'event'
  | 'trip'
  | 'driver'
  | 'depot'
  | 'metric'
  | 'timestamp';

export interface AiEvidenceReference {
  refType: AiEvidenceRefType;
  refId?: string;
  label: string;
  ts?: string;
  value?: string | number | boolean;
  meta?: Record<string, unknown>;
}

export interface AiEvidencePayload {
  generatedAt: string;
  references: AiEvidenceReference[];
}

export interface AiChatResponse {
  reply: string;
  model?: string;
  evidence?: AiEvidencePayload;
  references?: AiEvidenceReference[];
  context?: Record<string, unknown> | null;
}

export interface AiExplainAlertResponse {
  alertId: string;
  explanation: string;
  model?: string;
  evidence?: AiEvidencePayload;
  references?: AiEvidenceReference[];
}

export interface AiDailySummaryResponse {
  date: string;
  summary: string;
  model?: string;
  stats?: Record<string, unknown>;
  evidence?: AiEvidencePayload;
  references?: AiEvidenceReference[];
}

export interface VehicleState {
  vehicleId: string;
  vehicleRegNo: string;
  driverId?: string;
  tripId?: string;
  status: string;
  lastTelemetryId?: number;
  lastTs?: string;
  lat?: number;
  lng?: number;
  speedKph?: number;
  ignition?: boolean;
  idling?: boolean;
  fuelPct?: number;
  engineTempC?: number;
  batteryV?: number;
  odometerKm?: number;
  headingDeg?: number;
  activeAlertCount: number;
  maintenanceDue: boolean;
  updatedAt: string;
}

export interface FleetMode {
  mode: 'replay' | 'live';
  active_run_id: string | null;
  updated_at?: string;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  description?: string;
  timelineSec: number;
  steps: ScenarioStep[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioStep {
  scenarioId: string;
  stepNo: number;
  atSec: number;
  action: string;
  data: Record<string, unknown>;
}

export interface ScenarioRun {
  id: string;
  scenarioId?: string;
  mode: 'replay' | 'live';
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'RESET' | 'FAILED';
  seed?: number;
  speedFactor: number;
  startedAt: string;
  endedAt?: string;
  cursorTs?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type TripStatus = 'planned' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface TripSummary {
  id: string;
  vehicleId: string;
  vehicleRegNo: string;
  driverId: string;
  driverName?: string;
  routeId?: string;
  routeName?: string;
  scenarioRunId?: string;
  status: TripStatus;
  startedAt: string;
  endedAt?: string;
  plannedEtaAt?: string;
  startDepotId?: string;
  startDepotName?: string;
  endDepotId?: string;
  endDepotName?: string;
  plannedDistanceKm?: number;
  actualDistanceKm?: number;
  delayReason?: string;
  endReason?: string;
  stopCount?: number;
  openExceptionCount?: number;
  lastAssignedAt?: string;
}

export interface TripStop {
  id: number;
  tripId: string;
  seq: number;
  stopType: 'traffic' | 'delivery' | 'depot' | 'break' | 'incident';
  lat: number;
  lng: number;
  arrivedAt: string;
  departedAt?: string;
  reason?: string;
}

export interface TripDetail extends TripSummary {
  stops: TripStop[];
}

export interface TripAssignment {
  id: string;
  tripId: string;
  previousVehicleId?: string;
  previousDriverId?: string;
  previousRouteId?: string;
  newVehicleId?: string;
  newDriverId?: string;
  newRouteId?: string;
  assignedBy?: string;
  note?: string;
  metadata?: Record<string, unknown>;
  assignedAt: string;
  createdAt: string;
}

export interface TripException {
  id: string;
  tripId: string;
  exceptionType: 'sla_delay' | 'off_route' | 'idle_overrun' | 'fuel_anomaly' | 'manual_blocker';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'ACK' | 'RESOLVED';
  title: string;
  description: string;
  evidence?: Record<string, unknown>;
  openedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  raisedBy?: string;
  closedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripDispatchDetail extends TripSummary {
  assignments: TripAssignment[];
  exceptions: TripException[];
  stops?: TripStop[];
}

export interface InventoryTotals {
  total: number;
  onTrip: number;
  idle: number;
  parked: number;
  alerting: number;
  maintenanceDue: number;
  activeTrips: number;
  completedTrips: number;
}

export interface InventoryByType {
  vehicleType: string;
  count: number;
  onTrip: number;
  idle: number;
  parked: number;
}

export interface InventoryByDepot {
  depotId: string;
  depotName?: string;
  count: number;
  onTrip: number;
  idle: number;
  parked: number;
}

export interface InventorySnapshot {
  totals: InventoryTotals;
  byType: InventoryByType[];
  byDepot: InventoryByDepot[];
}

export interface DailyReportMetrics {
  vehicleCount: number;
  activeTrips: number;
  completedTrips: number;
  delayedTrips: number;
  onTimeTrips: number;
  distanceKm: number;
  tripHours: number;
  utilizationRatePct: number;
  delayRatePct: number;
  onTimeRatePct: number;
  alertCount: number;
  openAlertCount: number;
  highAlertCount: number;
  alertBurdenPerVehicle: number;
  maintenanceDowntimeHours: number;
}

export interface DailyReportResponse {
  date: string;
  depotId?: string | null;
  metrics: DailyReportMetrics;
}

export interface ExceptionReportRow {
  id: string;
  tripId: string;
  tripStatus?: string;
  driverId?: string;
  driverName?: string;
  vehicleId: string;
  vehicleRegNo?: string;
  depotId?: string;
  depotName?: string;
  exceptionType: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  openedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  closedBy?: string;
  raisedBy?: string;
  durationMin?: number;
}

export interface UtilizationReportRow {
  vehicleId: string;
  vehicleRegNo: string;
  vehicleType: string;
  depotId?: string;
  depotName?: string;
  tripCount: number;
  distanceKm: number;
  tripHours: number;
  utilizationPct: number;
  avgDistancePerTripKm: number;
  alertCount: number;
  highAlertCount: number;
  exceptionCount: number;
}

export interface UserRoleSummary {
  id: string;
  name: string;
  permissions: string[];
}

export interface AdminUserSummary {
  id: string;
  email?: string;
  displayName: string;
  isActive: boolean;
  roles: UserRoleSummary[];
}

export interface AuditLogEntry {
  id: string;
  actorId?: string;
  actorDisplayName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  payload?: Record<string, unknown>;
  ts: string;
}
