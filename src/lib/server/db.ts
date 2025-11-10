
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { subHours, formatISO, parse } from "date-fns";
import { DashboardData, PerformanceData, TimeSeriesData, WaitEvent } from "@/lib/types";

const HISTORY_DB_FILE = "performance_history.sqlite";

// Singleton instance for the database
let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

async function getDb() {
  if (!db) {
    db = await open({
      filename: HISTORY_DB_FILE,
      driver: sqlite3.Database,
    });
    await init_history_db(db);
  }
  return db;
}


async function init_history_db(dbInstance: Database) {
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
    // This table now stores EITHER rich ASH data OR simple v$session snapshots
    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS wait_events_history (
            server_id TEXT,
            timestamp TEXT,
            event_name TEXT,
            session_count INTEGER,
            latency_seconds REAL, -- Will be NULL for v$session snapshots
            is_snapshot INTEGER DEFAULT 0, -- Flag to distinguish data source
            PRIMARY KEY (server_id, timestamp, event_name)
        );
    `);
    await dbInstance.exec("CREATE INDEX IF NOT EXISTS idx_perf_summary_server_ts ON performance_summary(server_id, timestamp);");
    await dbInstance.exec("CREATE INDEX IF NOT EXISTS idx_perf_io_details_server_ts ON performance_io_details(server_id, timestamp);");
    await dbInstance.exec("CREATE INDEX IF NOT EXISTS idx_wait_events_server_ts ON wait_events_history(server_id, timestamp);");
    console.log("--- SERVER: SQLITE HISTORY DATABASE INITIALIZED ---");
}

async function _prune_old_performance_data() {
    const db = await getDb();
    const one_day_ago = formatISO(subHours(new Date(), 24));
    
    const summaryResult = await db.run("DELETE FROM performance_summary WHERE timestamp < ?", one_day_ago);
    const detailsResult = await db.run("DELETE FROM performance_io_details WHERE timestamp < ?", one_day_ago);
    const waitEventsResult = await db.run("DELETE FROM wait_events_history WHERE timestamp < ?", one_day_ago);
    
    const summary_deleted_count = summaryResult.changes || 0;
    const details_deleted_count = detailsResult.changes || 0;
    const wait_events_deleted_count = waitEventsResult.changes || 0;

    if (summary_deleted_count > 0 || details_deleted_count > 0 || wait_events_deleted_count > 0) {
        console.log(`--- SERVER: Pruned ${summary_deleted_count} summary, ${details_deleted_count} detail, and ${wait_events_deleted_count} wait event records older than 24 hours. ---`);
    }
}

export async function storePerformanceMetrics(server_id: string, timestamp: string, data: DashboardData) {
    const db = await getDb();
    const perf_data = data.current_performance;
    
    if (perf_data) {
        await db.run(
            `INSERT OR REPLACE INTO performance_summary 
            (server_id, timestamp, cpu_usage, memory_usage, io_read_total, io_write_total, network_up, network_down, active_sessions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                server_id,
                timestamp,
                perf_data.cpu,
                perf_data.memory,
                perf_data.io_read,
                perf_data.io_write,
                perf_data.network_up,
                perf_data.network_down,
                perf_data.active_sessions
            ]
        );
        
        const io_details = perf_data.io_details || [];
        for (const stats of io_details) {
             await db.run(
                `INSERT OR REPLACE INTO performance_io_details
                (server_id, timestamp, device, mount_point, read_mb_s, write_mb_s)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    server_id,
                    timestamp,
                    stats.device,
                    stats.mount_point,
                    stats.read_mb_s,
                    stats.write_mb_s
                ]
            );
        }
    }
    
    // Store historical wait events (either from ASH or v$session snapshot)
    const wait_events = data.topWaitEvents || [];
    for (const event of wait_events) {
        // ASH data has a 'data' property and comes with its own timestamp
        if (event.data && event.data.length > 0) { 
            for (const point of event.data) {
                // The timestamp from the agent is already in the correct ISO 8601 format.
                const isoDate = point.date;

                await db.run(
                    `INSERT OR REPLACE INTO wait_events_history
                    (server_id, timestamp, event_name, session_count, latency_seconds, is_snapshot)
                    VALUES (?, ?, ?, ?, ?, 0)`, // is_snapshot = 0 for ASH
                    [
                        server_id,
                        isoDate,
                        event.event,
                        point.value,
                        point.latency
                    ]
                );
            }
        }
        // v$session snapshot data does NOT have 'data' property, use the main report timestamp
        else if (event.value > 0) {
            await db.run(
                `INSERT OR REPLACE INTO wait_events_history
                (server_id, timestamp, event_name, session_count, latency_seconds, is_snapshot)
                VALUES (?, ?, ?, ?, NULL, 1)`, // is_snapshot = 1 for v$session
                [
                    server_id,
                    timestamp,
                    event.event,
                    event.value
                ]
            );
        }
    }
    
    await _prune_old_performance_data();
}

interface PerformanceHistory extends PerformanceData {
    activeSessionsHistory: TimeSeriesData[];
    topWaitEvents: WaitEvent[];
}

export async function getPerformanceHistory24h(server_id: string): Promise<PerformanceHistory> {
    const db = await getDb();
    const one_day_ago = formatISO(subHours(new Date(), 24));
    
    const summary_rows = await db.all(
        `SELECT timestamp, cpu_usage, memory_usage, io_read_total, io_write_total, network_up, network_down, active_sessions
         FROM performance_summary
         WHERE server_id = ? AND timestamp >= ?
         ORDER BY timestamp ASC`,
        [server_id, one_day_ago]
    );

    const io_detail_rows = await db.all(
        `SELECT timestamp, device, mount_point, read_mb_s, write_mb_s
         FROM performance_io_details
         WHERE server_id = ? AND timestamp >= ?
         ORDER BY timestamp ASC`,
        [server_id, one_day_ago]
    );

    const wait_event_rows = await db.all(
        `SELECT timestamp, event_name, session_count, latency_seconds, is_snapshot
         FROM wait_events_history
         WHERE server_id = ? AND timestamp >= ?
         ORDER BY timestamp ASC`,
        [server_id, one_day_ago]
    );

    // Process Wait Events
    const events_by_name: { [key: string]: WaitEvent } = {};
    for (const row of wait_event_rows) {
        const event_name = row.event_name;
        if (!events_by_name[event_name]) {
            // Initialize with the data key, which is required for the chart component
            events_by_name[event_name] = { "event": event_name, "value": 0, "data": [] };
        }
        
        // All data, whether from ASH or snapshot, is added to the 'data' array to build the chart
        events_by_name[event_name].data!.push({
            date: row.timestamp,
            value: row.session_count,
            latency: row.latency_seconds // Will be null for snapshots, which is fine
        });
    }

    // For both snapshot and ASH data, we need to sum the values to find the top events
    for(const eventName in events_by_name) {
        events_by_name[eventName].value = events_by_name[eventName].data!.reduce((acc, curr) => acc + curr.value, 0);
    }

    const topWaitEvents = Object.values(events_by_name).sort((a, b) => b.value - a.value);


    const io_details_map: { [key: string]: any[] } = {};
    for (const row of io_detail_rows) {
        if (!io_details_map[row.timestamp]) {
            io_details_map[row.timestamp] = [];
        }
        io_details_map[row.timestamp].push({
            'device': row.device,
            'mount_point': row.mount_point,
            'read_mb_s': row.read_mb_s,
            'write_mb_s': row.write_mb_s
        });
    }

    const performance_data: PerformanceHistory = {
        cpu: [], memory: [], io_read: [], io_write: [], 
        network_up: [], network_down: [], activeSessionsHistory: [],
        topWaitEvents: topWaitEvents
    };

    for (const row of summary_rows) {
        const ts = row.timestamp;
        performance_data.cpu!.push({ date: ts, value: row.cpu_usage });
        performance_data.memory!.push({ date: ts, value: row.memory_usage });
        performance_data.network_up!.push({ date: ts, value: row.network_up });
        performance_data.network_down!.push({ date: ts, value: row.network_down });
        performance_data.activeSessionsHistory.push({ date: ts, value: row.active_sessions });
        performance_data.io_read!.push({
            date: ts, 
            value: row.io_read_total,
            details: io_details_map[ts] || []
        });
        performance_data.io_write!.push({
            date: ts, 
            value: row.io_write_total,
            details: io_details_map[ts] || []
        });
    }

    return performance_data;
}


// In-memory storage for the latest data from each agent.
type ServerSnapshot = {
    data: DashboardData;
    last_updated: string;
};
export const db_data_store: { [key: string]: ServerSnapshot } = {};
