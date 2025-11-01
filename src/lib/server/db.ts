
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { subHours, formatISO } from "date-fns";
import { DashboardData, PerformanceData, TimeSeriesData, WaitEvent } from "@/lib/types";
import { generateMockDashboardData, generateHistoricPerformanceData } from "@/lib/server/db/mock-data";

// --- CONFIGURATION ---
const DB_FILE = "dashboard_data.sqlite";

// --- GLOBALS ---
let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

// --- DATABASE INITIALIZATION ---

/**
 * Gets a singleton database instance.
 */
async function getDb(): Promise<Database> {
  if (!db) {
    db = await open({
      filename: DB_FILE,
      driver: sqlite3.Database,
    });
    await initializeDatabase(db);
  }
  return db;
}

/**
 * Sets up the required database tables and indices.
 * This now includes the primary 'servers' table for the latest snapshot data.
 */
async function initializeDatabase(dbInstance: Database): Promise<void> {
    console.log("--- SERVER: Initializing database schema... ---");

    // 1. Table for the latest server data snapshot
    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS servers (
            id TEXT PRIMARY KEY,
            dbName TEXT,
            last_updated TEXT,
            dbIsUp BOOLEAN,
            dbStatus TEXT,
            osIsUp BOOLEAN,
            osInfo TEXT,
            host_memory TEXT,
            kpis TEXT,
            topCpuProcesses TEXT,
            topMemoryProcesses TEXT,
            topIoProcesses TEXT,
            topNetworkProcesses TEXT,
            diskUsage TEXT,
            tablespaces TEXT,
            backups TEXT,
            activeSessions TEXT,
            detailedActiveSessions TEXT,
            alertLog TEXT,
            topWaitEvents TEXT,
            standbyStatus TEXT
        );
    `);
    
    // 2. Table for historical performance summaries (for charts)
    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS performance_summary (
            server_id TEXT,
            timestamp TEXT,
            cpu_usage REAL,
            memory_usage REAL,
            io_read_total REAL,
            io_write_total REAL,
            network_up REAL,
            network_down REAL,
            active_sessions INTEGER,
            PRIMARY KEY (server_id, timestamp)
        );
    `);

    // 3. Table for historical I/O details
    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS performance_io_details (
            server_id TEXT,
            timestamp TEXT,
            device TEXT,
            mount_point TEXT,
            read_mb_s REAL,
            write_mb_s REAL,
            PRIMARY KEY (server_id, timestamp, device)
        );
    `);

    // 4. Table for historical wait events
    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS wait_events_history (
            server_id TEXT,
            timestamp TEXT,
            event_name TEXT,
            session_count INTEGER,
            latency_seconds REAL,
            PRIMARY KEY (server_id, timestamp, event_name)
        );
    `);

    // 5. Indices for performance
    await dbInstance.exec("CREATE INDEX IF NOT EXISTS idx_perf_summary_server_ts ON performance_summary(server_id, timestamp);");
    await dbInstance.exec("CREATE INDEX IF NOT EXISTS idx_perf_io_details_server_ts ON performance_io_details(server_id, timestamp);");
    await dbInstance.exec("CREATE INDEX IF NOT EXISTS idx_wait_events_server_ts ON wait_events_history(server_id, timestamp);");
    
    console.log("--- SERVER: Database schema initialized successfully. ---");
}


// --- DATA UPDATE FUNCTIONS ---

/**
 * Stores the full, latest snapshot of a server's data.
 * This should be called by the /api/report endpoint.
 */
export async function updateLatestServerData(data: DashboardData): Promise<void> {
    const db = await getDb();

    const params = [
        data.id, data.dbName, data.timestamp, data.dbIsUp, data.dbStatus, data.osIsUp,
        JSON.stringify(data.osInfo || null),
        JSON.stringify(data.host_memory || null),
        JSON.stringify(data.kpis || null),
        JSON.stringify(data.topCpuProcesses || []),
        JSON.stringify(data.topMemoryProcesses || []),
        JSON.stringify(data.topIoProcesses || []),
        JSON.stringify(data.topNetworkProcesses || []),
        JSON.stringify(data.diskUsage || []),
        JSON.stringify(data.tablespaces || []),
        JSON.stringify(data.backups || []),
        JSON.stringify(data.activeSessions || []),
        JSON.stringify(data.detailedActiveSessions || []),
        JSON.stringify(data.alertLog || []),
        JSON.stringify(data.topWaitEvents || []),
        JSON.stringify(data.standbyStatus || [])
    ];

    const columns = [
        'id', 'dbName', 'last_updated', 'dbIsUp', 'dbStatus', 'osIsUp', 'osInfo',
        'host_memory', 'kpis', 'topCpuProcesses', 'topMemoryProcesses', 'topIoProcesses',
        'topNetworkProcesses', 'diskUsage', 'tablespaces', 'backups', 'activeSessions',
        'detailedActiveSessions', 'alertLog', 'topWaitEvents', 'standbyStatus'
    ];
    const placeholders = columns.map(() => '?').join(',');

    const sql = `INSERT OR REPLACE INTO servers (${columns.join(',')}) VALUES (${placeholders})`;

    try {
        await db.run(sql, params);
        console.log(`--- SERVER: Successfully updated latest data snapshot for ${data.id} ---`);
    } catch (error) {
        console.error(`--- SERVER: Failed to update latest data for ${data.id} ---`, error);
    }
}

/**
 * Stores aggregated metrics for historical charts.
 */
export async function storePerformanceMetrics(server_id: string, timestamp: string, data: DashboardData): Promise<void> {
    const db = await getDb();
    const perf_data = data.current_performance;
    
    await db.run('BEGIN TRANSACTION');
    try {
        if (perf_data) {
            await db.run(
                `INSERT OR IGNORE INTO performance_summary (server_id, timestamp, cpu_usage, memory_usage, io_read_total, io_write_total, network_up, network_down, active_sessions)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [server_id, timestamp, perf_data.cpu, perf_data.memory, perf_data.io_read, perf_data.io_write, perf_data.network_up, perf_data.network_down, perf_data.active_sessions]
            );
        }
        
        await db.run('COMMIT');
    } catch (error) {
        console.error("--- SERVER: Failed to store historical performance metrics ---", error);
        await db.run('ROLLBACK');
    }
}


// --- DATA RETRIEVAL FUNCTIONS ---

/**
 * Retrieves the latest snapshot for a given server.
 * Used to build the main dashboard view.
 */
export async function getLatestServerData(server_id: string): Promise<DashboardData | null> {
    const db = await getDb();
    const row = await db.get("SELECT * FROM servers WHERE id = ?", server_id);

    if (!row) {
        return null;
    }

    // The row object from the DB needs to be parsed and cast to the DashboardData type.
    const data: DashboardData = {
        id: row.id,
        dbName: row.dbName,
        timestamp: row.last_updated,
        dbIsUp: Boolean(row.dbIsUp),
        dbStatus: row.dbStatus,
        osIsUp: Boolean(row.osIsUp),
        osInfo: JSON.parse(row.osInfo || 'null'),
        host_memory: JSON.parse(row.host_memory || 'null'),
        kpis: JSON.parse(row.kpis || 'null'),
        topCpuProcesses: JSON.parse(row.topCpuProcesses || '[]'),
        topMemoryProcesses: JSON.parse(row.topMemoryProcesses || '[]'),
        topIoProcesses: JSON.parse(row.topIoProcesses || '[]'),
        topNetworkProcesses: JSON.parse(row.topNetworkProcesses || '[]'),
        diskUsage: JSON.parse(row.diskUsage || '[]'),
        tablespaces: JSON.parse(row.tablespaces || '[]'),
        backups: JSON.parse(row.backups || '[]'),
        activeSessions: JSON.parse(row.activeSessions || '[]'),
        detailedActiveSessions: JSON.parse(row.detailedActiveSessions || '[]'),
        alertLog: JSON.parse(row.alertLog || '[]'),
        topWaitEvents: JSON.parse(row.topWaitEvents || '[]'),
        standbyStatus: JSON.parse(row.standbyStatus || '[]'),
        // current_performance is not stored in the main snapshot table, it's for history.
        current_performance: null 
    };
    
    return data;
}

/**
 * Retrieves the list of all unique servers that have reported data.
 */
export async function getAllServerIds(): Promise<{ id: string, dbName: string }[]> {
    const db = await getDb();
    return await db.all("SELECT id, dbName FROM servers ORDER BY id ASC");
}

/**
 * Retrieves historical performance data for the last 24 hours for charts.
 */
export async function getPerformanceHistory24h(server_id: string): Promise<PerformanceData> {
    // This function can be expanded later to pull the detailed historical data
    // For now, it returns an empty structure.
    const performance_data: PerformanceData = {
        cpu: [], memory: [], io_read: [], io_write: [], 
        network_up: [], network_down: [],
    };
    return performance_data;
}

// --- MOCK DATA & PRUNING ---
// (These can be removed if you are not using mock data)

/**
 * Prunes data older than 24 hours from historical tables.
 */
async function _prune_old_performance_data() {
    const db = await getDb();
    const one_day_ago = formatISO(subHours(new Date(), 24));
    
    const result = await db.run("DELETE FROM performance_summary WHERE timestamp < ?", one_day_ago);
    if ((result.changes || 0) > 0) {
        console.log(`--- SERVER: Pruned ${result.changes} historical records older than 24 hours. ---`);
    }
}
setInterval(_prune_old_performance_data, 1000 * 60 * 60); // Prune every hour

