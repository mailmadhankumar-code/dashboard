
import { db_data_store } from './db';
import { getSettings } from './settings';
import { AlertManager } from './alert-manager';
import type { DashboardData } from '../types';

const MONITOR_INTERVAL_SECONDS = 60;
const STATUS_TIMEOUT_SECONDS = 90;

let isRunning = false;
let alertManager: AlertManager | null = null;

// This function is the core of the background monitor.
async function checkServerStatuses() {
  const now = new Date();
  const settings = await getSettings();
  
  if (!alertManager) {
    alertManager = new AlertManager(settings);
  } else {
    alertManager.settings = settings;
  }

  const allConfiguredDbs = settings.emailSettings?.customers?.flatMap(c => c.databases) || [];
  
  // Create a Set of all valid, configured database IDs for quick lookup.
  const configuredDbIds = new Set(allConfiguredDbs.map(db => db.id));

  // Iterate over all configured DBs from settings
  for (const db of allConfiguredDbs) {
    const server_id = db.id;
    if (!server_id) continue; // Skip if a db config is missing an id

    const server_snapshot = db_data_store[server_id];

    let isStale = true;
    if (server_snapshot && server_snapshot.last_updated) {
      const lastUpdated = new Date(server_snapshot.last_updated);
      const secondsSinceUpdate = (now.getTime() - lastUpdated.getTime()) / 1000;
      if (secondsSinceUpdate <= STATUS_TIMEOUT_SECONDS) {
        isStale = false;
      }
    }

    if (isStale) {
      console.log(`[Monitor] Server ${server_id} is stale (no report in > ${STATUS_TIMEOUT_SECONDS}s). Triggering OS/DB down alert check.`);
      // If the server is stale, it means the OS is down or the agent is not running.
      // We create a "synthetic" data payload to represent this state and pass it to the alert manager.
      const staleDataPayload: DashboardData = {
        ...(server_snapshot?.data || { // Use existing data if available, otherwise create a shell
            id: server_id,
            dbName: db.name,
            timestamp: now.toISOString(),
            kpis: { cpuUsage: 0, memoryUsage: 0, activeSessions: 0 },
            performance: {},
            tablespaces: [],
            backups: [],
            activeSessions: [],
            detailedActiveSessions: [],
            activeSessionsHistory: [],
            alertLog: [],
            diskUsage: [],
            topWaitEvents: [],
            standbyStatus: [],
            customers: [],
            osInfo: { platform: 'Unknown', release: '' },
            current_performance: { cpu:0, memory: 0, io_read: 0, io_write: 0, network_up: 0, network_down: 0, active_sessions: 0, io_details: [] }
        }),
        dbIsUp: false, // If OS is down, DB is effectively down
        osIsUp: false, // The reason we are here is because the OS is not reporting
        dbStatus: 'UNKNOWN',
      };
      
      // Pass this synthetic "down" payload to the alert manager for processing
      await alertManager.process_alerts(server_id, staleDataPayload);

    } else if (server_snapshot) {
      // If the server is NOT stale, its agent is reporting in.
      // We run the alert manager on its LATEST reported data. This will handle cases
      // where the OS is up but the database itself is reported as down.
      await alertManager.process_alerts(server_id, server_snapshot.data);
    }
  }
}

// This ensures the monitor starts only once.
export function startMonitoring() {
  if (isRunning) {
    return;
  }
  
  console.log(`[Monitor] Starting background server monitor. Interval: ${MONITOR_INTERVAL_SECONDS} seconds.`);
  setInterval(checkServerStatuses, MONITOR_INTERVAL_SECONDS * 1000);
  isRunning = true;
  
  // Run it once immediately on startup.
  checkServerStatuses();
}

// Start the monitor when this module is loaded.
startMonitoring();
