
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { subHours, formatISO } from "date-fns";
import { DashboardData, PerformanceData, TimeSeriesData, WaitEvent } from "@/lib/types";
import { generateMockDashboardData, generateHistoricPerformanceData } from "@/lib/server/db/mock-data";

const HISTORY_DB_FILE = "performance_history.sqlite";

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
let is_mock_data_initialized = false;

async function initialize_mock_data(dbInstance: Database) {
    if (is_mock_data_initialized) return;

    console.log("--- SERVER: Initializing mock data ---");

    // 1. Populate the in-memory store with real-time data
    const mock_server_ids = ["prod-db-1", "dev-db-1", "t800-db"];
    for (const server_id of mock_server_ids) {
        const dbName = server_id.includes("prod") ? "PRODDB" : server_id.includes("dev") ? "DEVDB" : "SKYNETDB";
        db_data_store[server_id] = {
            data: generateMockDashboardData(server_id, dbName),
            last_updated: new Date().toISOString(),
        };
    }

    // 2. Populate the SQLite database with historical data
    try {
        await dbInstance.run('BEGIN TRANSACTION');
        
        const stmt = await dbInstance.prepare(
            `INSERT OR IGNORE INTO performance_summary 
            (server_id, timestamp, cpu_usage, memory_usage, io_read_total, io_write_total, network_up, network_down, active_sessions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        for (const server_id of mock_server_ids) {
            const historic_data = generateHistoricPerformanceData(server_id);
            for (const record of historic_data) {
                await stmt.run(
                    record.server_id,
                    record.timestamp,
                    record.cpu_usage,
                    record.memory_usage,
                    record.io_read_total,
                    record.io_write_total,
                    record.network_up,
                    record.network_down,
                    record.active_sessions
                );
            }
        }
        
        await stmt.finalize();
        await dbInstance.run('COMMIT');
        
        console.log("--- SERVER: Successfully populated SQLite with historic mock data ---");

    } catch (error) {
        console.error("--- SERVER: Failed to populate historic mock data ---", error);
        await dbInstance.run('ROLLBACK');
    }
    
    is_mock_data_initialized = true;
}


async function getDb() {
  if (!db) {
    db = await open({
      filename: HISTORY_DB_FILE,
      driver: sqlite3.Database,
    });
    await init_history_db(db);
    await initialize_mock_data(db);
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
    
    await db.run('BEGIN TRANSACTION');
    try {
        if (perf_data) {
            await db.run(
                `INSERT OR IGNORE INTO performance_summary 
                (server_id, timestamp, cpu_usage, memory_usage, io_read_total, io_write_total, network_up, network_down, active_sessions)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ,
                [server_id, timestamp, perf_data.cpu, perf_data.memory, perf_data.io_read, perf_data.io_write, perf_data.network_up, perf_data.network_down, perf_data.active_sessions]
            );
            
            const io_details = perf_data.io_details || {};
            if (io_details && typeof io_details === 'object') {
              for (const device of Object.keys(io_details)) {
                  const stats = io_details[device];
                  if (stats) {
                      await db.run(
                          `INSERT OR IGNORE INTO performance_io_details
                          (server_id, timestamp, device, mount_point, read_mb_s, write_mb_s)
                          VALUES (?, ?, ?, ?, ?, ?)`
                      ,
                          [server_id, timestamp, device, null, stats.read_mb_s, stats.write_mb_s]
                      );
                  }
              }
            }
        }
        
        const wait_events = data.topWaitEvents || [];
        for (const event of wait_events) {
            if (event.data && event.data.length > 0) { 
                for (const point of event.data) {
                    const isoDate = point.date;
                    await db.run(
                        `INSERT OR IGNORE INTO wait_events_history
                        (server_id, timestamp, event_name, session_count, latency_seconds)
                        VALUES (?, ?, ?, ?, ?)`
                    ,
                        [server_id, isoDate, event.event, point.value, point.latency]
                    );
                }
            } else if (event.value > 0) {
                await db.run(
                    `INSERT OR IGNORE INTO wait_events_history
                    (server_id, timestamp, event_name, session_count, latency_seconds)
                    VALUES (?, ?, ?, ?, NULL)`
                ,
                    [server_id, timestamp, event.event, event.value]
                );
            }
        }
        await db.run('COMMIT');
    } catch (error) {
        console.error("Failed to store performance metrics:", error);
        await db.run('ROLLBACK');
    }
    
    await _prune_old_performance_data();
}



interface PerformanceHistory extends PerformanceData {
    activeSessionsHistory: TimeSeriesData[];
    topWaitEvents: WaitEvent[];
}

async function getTopWaitEvents(db: Database, server_id: string, one_day_ago: string): Promise<WaitEvent[]> {
    const wait_event_rows = await db.all(
        `SELECT 
            event_name,
            SUM(session_count) as total_sessions,
            json_group_array(json_object(
                'date', timestamp,
                'value', session_count,
                'latency', latency_seconds
            )) as data
         FROM wait_events_history
         WHERE server_id = ? AND timestamp >= ?
         GROUP BY event_name
         ORDER BY total_sessions DESC`
    ,
        [server_id, one_day_ago]
    );

    return wait_event_rows.map(row => ({
        event: row.event_name,
        value: row.total_sessions,
        data: JSON.parse(row.data),
    }));
}

export async function getPerformanceHistory24h(server_id: string): Promise<PerformanceHistory> {
    const db = await getDb();
    const one_day_ago = formatISO(subHours(new Date(), 24));

    const summary_rows = await db.all(
        `SELECT 
            timestamp, 
            json_object(
                'date', timestamp, 
                'value', cpu_usage
            ) as cpu, 
            json_object(
                'date', timestamp, 
                'value', memory_usage
            ) as memory,
            json_object(
                'date', timestamp, 
                'value', network_up
            ) as network_up,
            json_object(
                'date', timestamp, 
                'value', network_down
            ) as network_down,
            json_object(
                'date', timestamp, 
                'value', active_sessions
            ) as active_sessions,
            json_object(
                'date', timestamp,
                'value', io_read_total,
                'details', (SELECT json_group_array(json_object('device', device, 'mount_point', mount_point, 'read_mb_s', read_mb_s, 'write_mb_s', write_mb_s)) FROM performance_io_details WHERE server_id = s.server_id AND timestamp = s.timestamp)
            ) as io_read,
            json_object(
                'date', timestamp,
                'value', io_write_total,
                'details', (SELECT json_group_array(json_object('device', device, 'mount_point', mount_point, 'read_mb_s', read_mb_s, 'write_mb_s', write_mb_s)) FROM performance_io_details WHERE server_id = s.server_id AND timestamp = s.timestamp)
            ) as io_write
         FROM performance_summary s
         WHERE s.server_id = ? AND s.timestamp >= ?
         ORDER BY s.timestamp ASC`
    ,
        [server_id, one_day_ago]
    );

    const topWaitEvents = await getTopWaitEvents(db, server_id, one_day_ago);
    
    const performance_data: PerformanceHistory = {
        cpu: [], memory: [], io_read: [], io_write: [], 
        network_up: [], network_down: [], activeSessionsHistory: [],
        topWaitEvents: topWaitEvents
    };

    for (const row of summary_rows) {
        performance_data.cpu.push(JSON.parse(row.cpu));
        performance_data.memory.push(JSON.parse(row.memory));
        performance_data.network_up.push(JSON.parse(row.network_up));
        performance_data.network_down.push(JSON.parse(row.network_down));
        performance_data.activeSessionsHistory.push(JSON.parse(row.active_sessions));
        performance_data.io_read.push(JSON.parse(row.io_read));
        performance_data.io_write.push(JSON.parse(row.io_write));
    }

    return performance_data;
}


// In-memory storage for the latest data from each agent.
type ServerSnapshot = {
    data: DashboardData;
    last_updated: string;
};
export const db_data_store: { [key: string]: ServerSnapshot } = {};
