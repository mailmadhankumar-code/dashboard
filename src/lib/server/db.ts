
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { subHours, formatISO } from "date-fns";
import { DashboardData, PerformanceData, TimeSeriesData, WaitEvent } from "@/lib/types";
import { generateMockDashboardData, generateHistoricPerformanceData } from "@/lib/server/db/mock-data";

const DB_FILE = "dashboard_data.sqlite";

// In-memory store for the latest server data snapshot
interface ServerSnapshot {
    last_updated: string;
    data: DashboardData;
}
export const db_data_store: { [key: string]: ServerSnapshot } = {};

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
let db_initialized = false;

async function initialize_database(dbInstance: Database) {
    if (db_initialized) return;

    console.log("--- SERVER: Initializing database schema ---");
    
    // Create the servers table to hold the latest snapshot of data for each server
    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS servers (
            id TEXT PRIMARY KEY,
            dbName TEXT,
            last_updated TEXT,
            dbIsUp BOOLEAN,
            dbStatus TEXT,
            dbUptime TEXT,
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
    
    // Create tables for historical data
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

    // Create indexes for performance
    await dbInstance.exec("CREATE INDEX IF NOT EXISTS idx_perf_summary_server_ts ON performance_summary(server_id, timestamp);");
    await dbInstance.exec("CREATE INDEX IF NOT EXISTS idx_perf_io_details_server_ts ON performance_io_details(server_id, timestamp);");
    await dbInstance.exec("CREATE INDEX IF NOT EXISTS idx_wait_events_server_ts ON wait_events_history(server_id, timestamp);");

    console.log("--- SERVER: Database schema initialized ---");
    db_initialized = true;
}


export async function getDb() {
  if (!db) {
    db = await open({
      filename: DB_FILE,
      driver: sqlite3.Database,
    });
    await initialize_database(db);
  }
  return db;
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

export async function updateServerData(server_id: string, data: DashboardData) {
    const db = await getDb();
    
    // Ensure the server exists before updating
    const server = await db.get("SELECT id FROM servers WHERE id = ?", server_id);
    if (!server) {
        // If the server doesn't exist, create it.
        await db.run(
            `INSERT INTO servers (id, dbName, last_updated, dbIsUp, dbStatus, dbUptime, osIsUp, osInfo, host_memory, kpis, topCpuProcesses, topMemoryProcesses, topIoProcesses, topNetworkProcesses, diskUsage, tablespaces, backups, activeSessions, detailedActiveSessions, alertLog, topWaitEvents, standbyStatus) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ,
            server_id,
            data.dbName,
            data.timestamp,
            data.dbIsUp,
            data.dbStatus,
            data.dbUptime,
            data.osIsUp,
            JSON.stringify(data.osInfo),
            JSON.stringify(data.host_memory),
            JSON.stringify(data.kpis),
            JSON.stringify(data.topCpuProcesses),
            JSON.stringify(data.topMemoryProcesses),
            JSON.stringify(data.topIoProcesses),
            JSON.stringify(data.topNetworkProcesses),
            JSON.stringify(data.diskUsage),
            JSON.stringify(data.tablespaces),
            JSON.stringify(data.backups),
            JSON.stringify(data.activeSessions),
            JSON.stringify(data.detailedActiveSessions),
            JSON.stringify(data.alertLog),
            JSON.stringify(data.topWaitEvents),
            JSON.stringify(data.standbyStatus)
        );
    } else {
        // If the server exists, update it.
        await db.run(
            `UPDATE servers 
            SET 
                dbName = ?, 
                last_updated = ?, 
                dbIsUp = ?, 
                dbStatus = ?, 
                dbUptime = ?,
                osIsUp = ?, 
                osInfo = ?, 
                host_memory = ?, 
                kpis = ?, 
                topCpuProcesses = ?, 
                topMemoryProcesses = ?, 
                topIoProcesses = ?, 
                topNetworkProcesses = ?, 
                diskUsage = ?, 
                tablespaces = ?, 
                backups = ?, 
                activeSessions = ?, 
                detailedActiveSessions = ?, 
                alertLog = ?, 
                topWaitEvents = ?, 
                standbyStatus = ?
            WHERE id = ?`
        ,
            data.dbName,
            data.timestamp,
            data.dbIsUp,
            data.dbStatus,
            data.dbUptime,
            data.osIsUp,
            JSON.stringify(data.osInfo),
            JSON.stringify(data.host_memory),
            JSON.stringify(data.kpis),
            JSON.stringify(data.topCpuProcesses),
            JSON.stringify(data.topMemoryProcesses),
            JSON.stringify(data.topIoProcesses),
            JSON.stringify(data.topNetworkProcesses),
            JSON.stringify(data.diskUsage),
            JSON.stringify(data.tablespaces),
            JSON.stringify(data.backups),
            JSON.stringify(data.activeSessions),
            JSON.stringify(data.detailedActiveSessions),
            JSON.stringify(data.alertLog),
            JSON.stringify(data.topWaitEvents),
            JSON.stringify(data.standbyStatus),
            server_id
        );
    }
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

export async function getServerData(server_id: string): Promise<DashboardData | null> {
    const db = await getDb();
    const row = await db.get("SELECT * FROM servers WHERE id = ?", server_id);

    if (!row) {
        return null;
    }

    // The data is stored as JSON strings, so we need to parse it.
    const data: DashboardData = {
        id: row.id,
        dbName: row.dbName,
        timestamp: row.last_updated,
        dbIsUp: Boolean(row.dbIsUp),
        dbStatus: row.dbStatus,
        dbUptime: row.dbUptime,
        osIsUp: Boolean(row.osIsUp),
        osInfo: JSON.parse(row.osInfo),
        kpis: JSON.parse(row.kpis),
        tablespaces: JSON.parse(row.tablespaces),
        backups: JSON.parse(row.backups),
        activeSessions: JSON.parse(row.activeSessions),
        detailedActiveSessions: JSON.parse(row.detailedActiveSessions),
        alertLog: JSON.parse(row.alertLog),
        topWaitEvents: JSON.parse(row.topWaitEvents),
        standbyStatus: JSON.parse(row.standbyStatus),
        // These are not stored in the servers table, so we'll need to get them from elsewhere or handle them.
        current_performance: { 
            cpu: 0, memory: 0, io_read: 0, io_write: 0, 
            network_up: 0, network_down: 0, active_sessions: 0,
            io_details: [] 
        },
        performance: { cpu: [], memory: [], io_read: [], io_write: [], network_up: [], network_down: [] },
        activeSessionsHistory: [],
        customers: [],
    };
    
    return data;
}

// Add a function to get all servers for the overview page
export async function getAllServers() {
    const db = await getDb();
    const rows = await db.all("SELECT * FROM servers");
    return rows.map(row => ({
        id: row.id,
        dbName: row.dbName,
        customerName: 'N/A', // You might want to add a customer table later
        dbIsUp: Boolean(row.dbIsUp),
        osIsUp: Boolean(row.osIsUp),
        dbStatus: row.dbStatus,
        cpuUsage: JSON.parse(row.kpis).cpuUsage,
        memoryUsage: JSON.parse(row.kpis).memoryUsage,
        activeSessions: JSON.parse(row.kpis).activeSessions,
        uptime: JSON.parse(row.osInfo).uptime,
    }));
}
