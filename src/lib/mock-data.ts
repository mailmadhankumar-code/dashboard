import {
  DashboardData,
  TimeSeriesData,
  Customer,
  Kpi,
  PerformanceData,
  Tablespace,
  RmanBackup,
  ActiveSession,
  DetailedActiveSession,
  AlertLogEntry,
  DiskUsage,
  WaitEvent,
  WaitEventDataPoint,
  Alert,
  OsInfo,
  Settings,
} from "./types";
import { subHours } from "date-fns";

// This file provides the initial structure and any static data for the dashboard.
// Most of the data is fetched from the Python server and will overwrite the initial values.


// Initial empty values. These will be populated by the first API call.
const kpis: Kpi = {
  cpuUsage: 0,
  memoryUsage: 0,
  activeSessions: 0,
};

const performance: PerformanceData = {
  cpu: [],
  memory: [],
  io_read: [],
  io_write: [],
  network_up: [],
  network_down: [],
};

const tablespaces: Tablespace[] = [];
const backups: RmanBackup[] = [];
const activeSessions: ActiveSession[] = [];
const detailedActiveSessions: DetailedActiveSession[] = [];
const activeSessionsHistory: TimeSeriesData[] = [];
const alertLog: AlertLogEntry[] = [];
const diskUsage: DiskUsage[] = [];
const topWaitEvents: WaitEvent[] = [];
const osInfo: OsInfo = { platform: "Unknown", release: "" };


export const initialData: DashboardData = {
  // @ts-ignore
  id: "",
  dbName: "",
  timestamp: new Date().toISOString(),
  dbIsUp: false,
  osIsUp: false,
  customers: [], // This is now sourced from settings
  kpis,
  performance,
  tablespaces,
  backups,
  activeSessions,
  detailedActiveSessions,
  alertLog,
  diskUsage,
  topWaitEvents,
  activeSessionsHistory,
  osInfo,
};

export type { Alert, Settings };
