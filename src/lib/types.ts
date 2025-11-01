
import { ProcessInfo } from "./process-info";

export interface Database {
  id: string;
  name: string;
  isUp: boolean;
  osUp: boolean;
  osType?: string;
}

export interface Customer {
  id: string;
  name: string;
  emails?: string[];
  databases: Database[];
}

export interface Kpi {
  cpuUsage: number;
  memoryUsage: number;
  activeSessions: number;
  memoryUsedGB?: number;
  memoryTotalGB?: number;
}

export interface IoDetail {
  device: string;
  mount_point: string;
  read_mb_s: number;
  write_mb_s: number;
}

export interface TimeSeriesData {
  date: string;
  value: number;
  details?: IoDetail[];
}

export interface PerformanceData {
  cpu?: TimeSeriesData[];
  memory?: TimeSeriesData[];
  io_read?: TimeSeriesData[];
  io_write?: TimeSeriesData[];
  network_up?: TimeSeriesData[];
  network_down?: TimeSeriesData[];
}

export interface Tablespace {
  name: string;
  total_gb: number;
  used_gb: number;
  used_percent: number;
}

export interface RmanBackup {
  id: string;
  db_name: string;
  start_time: string;
  end_time: string | null;
  status: "COMPLETED" | "FAILED" | "RUNNING" | string;
  input_bytes?: number | null;
  output_bytes?: number | null;
  elapsed_seconds?: number | null;
}

export interface ActiveSession {
  sid: number;
  username: string;
  program: string;
}

export interface DetailedActiveSession {
  inst: number;
  sid: number;
  username: string;
  sql_id: string;
  status: string;
  event: string;
  et: number;
  obj: number;
  bs: number;
  bi: number;
  module: string;
  machine: string;
  terminal: string;
}

export interface AlertLogEntry {
  id: string;
  timestamp: string;
  error_code: string;
}

export interface DiskUsage {
    mount_point: string;
    total_gb: number;
    used_gb: number;
    used_percent: number;
}

export interface WaitEvent {
    event: string;
    value: number; // For snapshot data (from v$session), this is the count of sessions.
    data?: WaitEventDataPoint[]; // For historical data (from ASH)
}

export interface WaitEventDataPoint {
  date: string;
  value: number; // represents number of waits
  latency: number; // represents total wait time in seconds
}


export interface Alert {
    id: string;
    type: 'warning' | 'error';
    title: string;
    message: string;
}

export interface OsInfo {
  platform: string;
  release: string;
  uptime: string;
  totalCpu: number;
  totalMemory: number;
  topCpuProcesses: ProcessInfo[];
  topMemoryProcesses: ProcessInfo[];
  topNetworkProcesses: ProcessInfo[];
  topIoProcesses?: ProcessInfo[];
}

export interface StandbyStatus {
    name: string;
    status: "SYNCHRONIZED" | "LAGGING" | "APPLYING" | string;
    transport_lag: string;
    apply_lag: string;
    mrp_status: string;
    sequence: number;
    apply_rate_mb_s: number;
}

interface EmailCustomer {
    id: string;
    name: string;
    emails: string[];
    databases: { id: string; name: string }[];
}

interface User {
  email: string;
  username: string;
  password?: string;
  role: 'admin' | 'user';
  customerIds?: string[];
}

export interface UserSession {
  email: string;
  username: string;
  role: 'admin' | 'user';
  customerIds?: string[];
}


export interface Settings {
    tablespaceThreshold: number;
    diskUsageThreshold: number;
    thresholds: {
        cpu: number;
        memory: number;
    };
    alertExclusions?: {
        excludedDisks?: string[];
        excludedOraErrors?: string[];
    };
    emailSettings?: {
        adminEmails?: string[];
        customers?: EmailCustomer[];
    };
    users?: User[];
}

export interface DashboardData {
  id: string;
  dbName: string;
  timestamp: string;
  dbIsUp: boolean;
  dbStatus: string;
  osIsUp: boolean;
  osInfo?: OsInfo;
  kpis: Kpi;
  current_performance: {
    cpu: number;
    memory: number;
    io_read: number;
    io_write: number;
    io_details: IoDetail[];
    network_up: number;
    network_down: number;
    active_sessions: number;
  };
  performance: PerformanceData;
  tablespaces: Tablespace[];
  backups: RmanBackup[];
  activeSessions: ActiveSession[];
  detailedActiveSessions: DetailedActiveSession[];
  activeSessionsHistory: TimeSeriesData[];
  alertLog: AlertLogEntry[];
  diskUsage: DiskUsage[];
  topWaitEvents: WaitEvent[];
  standbyStatus: StandbyStatus[];
  customers: Customer[];
  topCpuProcesses?: ProcessInfo[];
  topMemoryProcesses?: ProcessInfo[];
  topIoProcesses?: ProcessInfo[];
}

export interface OverviewRow {
    id: string;
    dbName: string;
    customerName: string;
    dbIsUp: boolean;
    osIsUp: boolean;
    dbStatus: string;
    cpuUsage: number;
    memoryUsage: number;
    activeSessions: number;
    uptime: string;
}

// This is the shape of the data coming from the /data endpoint
export type ServerDataPayload = {
    [key: string]: {
        data: DashboardData;
        last_updated: string;
    }
}
