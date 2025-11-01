
import { subHours, formatISO } from "date-fns";
import type { DashboardData, ServerDataPayload } from "./types";

const now = new Date();

function generateTimeSeries(points: number, max: number, min: number = 0) {
  return Array.from({ length: points }, (_, i) => ({
    date: formatISO(subHours(now, points - i)),
    value: Math.max(min, Math.random() * max),
  }));
}

function generateIoTimeSeries(points: number) {
    const read = [];
    const write = [];

    for (let i = 0; i < points; i++) {
        const date = formatISO(subHours(now, points - i));
        const totalRead = Math.random() * 25 + 5; // Total read between 5-30
        const totalWrite = Math.random() * 20 + 3; // Total write between 3-23
        
        read.push({
            date,
            value: totalRead,
            details: [
                { device: '/dev/sda1', mount_point: '/', read_mb_s: totalRead * 0.6, write_mb_s: totalWrite * 0.5},
                { device: '/dev/sdb1', mount_point: '/u01', read_mb_s: totalRead * 0.4, write_mb_s: totalWrite * 0.5},
            ]
        });
        write.push({
            date,
            value: totalWrite,
            details: [
                { device: '/dev/sda1', mount_point: '/', read_mb_s: totalRead * 0.6, write_mb_s: totalWrite * 0.5},
                { device: '/dev/sdb1', mount_point: '/u01', read_mb_s: totalRead * 0.4, write_mb_s: totalWrite * 0.5},
            ]
        });
    }
    return { read, write };
}


const waitEventNames = ["db file sequential read", "log file sync", "CPU", "db file scattered read", "direct path read"];

function generateWaitEvents(points: number) {
    const events: { [key: string]: any[] } = {};
    waitEventNames.forEach(name => events[name] = []);
    
    for (let i = 0; i < points; i++) {
        const date = formatISO(subHours(now, points - i));
        waitEventNames.forEach(name => {
            events[name].push({
                date,
                value: Math.floor(Math.random() * (name === "CPU" ? 10 : 5)),
                latency: Math.random() * 0.1
            });
        });
    }

    return waitEventNames.map(name => ({
        event: name,
        value: events[name].reduce((acc, p) => acc + p.value, 0),
        data: events[name]
    }));
}


const ioData = generateIoTimeSeries(24);

const demoDb1: DashboardData = {
  id: "demo1",
  dbName: "DEMO_PRIMARY",
  timestamp: formatISO(now),
  dbIsUp: true,
  dbStatus: "OPEN",
  osIsUp: true,
  osInfo: { platform: "Linux", release: "Oracle Linux 8" },
  kpis: {
    cpuUsage: 35.2,
    memoryUsage: 65.8,
    activeSessions: 12,
  },
  current_performance: {
    cpu: 35.2,
    memory: 65.8,
    io_read: 15.7,
    io_write: 8.2,
    io_details: [
        { device: '/dev/sda1', mount_point: '/', read_mb_s: 9.4, write_mb_s: 4.1 },
        { device: '/dev/sdb1', mount_point: '/u01', read_mb_s: 6.3, write_mb_s: 4.1 },
    ],
    network_up: 1.2,
    network_down: 5.4,
    active_sessions: 12,
  },
  performance: {
    cpu: generateTimeSeries(24, 60, 10),
    memory: generateTimeSeries(24, 75, 50),
    io_read: ioData.read,
    io_write: ioData.write,
    network_up: generateTimeSeries(24, 5, 0),
    network_down: generateTimeSeries(24, 15, 2),
  },
  tablespaces: [
    { name: "USERS", total_gb: 100, used_gb: 92.5, used_percent: 92.5 },
    { name: "SYSTEM", total_gb: 20, used_gb: 15.2, used_percent: 76 },
    { name: "UNDOTBS1", total_gb: 50, used_gb: 30.1, used_percent: 60.2 },
    { name: "SYSAUX", total_gb: 25, used_gb: 12.3, used_percent: 49.2 },
  ],
  backups: [
    { id: "bk1", db_name: "DEMO_PRIMARY", start_time: formatISO(subHours(now, 5)), end_time: formatISO(subHours(now, 4)), status: "COMPLETED", input_bytes: 1.5e11, output_bytes: 3e10, elapsed_seconds: 3600 },
    { id: "bk2", db_name: "DEMO_PRIMARY", start_time: formatISO(subHours(now, 29)), end_time: formatISO(subHours(now, 28)), status: "COMPLETED", input_bytes: 1.5e11, output_bytes: 3e10, elapsed_seconds: 3600 },
    { id: "bk3", db_name: "DEMO_PRIMARY", start_time: formatISO(subHours(now, 53)), end_time: formatISO(subHours(now, 52)), status: "FAILED", input_bytes: 1e10, output_bytes: 0, elapsed_seconds: 600 },
  ],
  activeSessions: [
    { sid: 123, username: "DEMOUSER", program: "SQL Developer" },
    { sid: 456, username: "SYS", program: "Toad.exe" },
  ],
  detailedActiveSessions: [
    { inst: 1, sid: 123, username: 'DEMOUSER', sql_id: 'g23xyz', status: 'ACTIVE', event: 'db file sequential read', et: 120, obj: 12345, bs: 0, bi: 0, module: 'SQL Developer', machine: 'workstation-1', terminal: 'pts/1' },
    { inst: 1, sid: 789, username: 'SYS', sql_id: 'a98b7c', status: 'ACTIVE', event: 'log file sync', et: 30, obj: 0, bs: 123, bi: 1, module: 'Toad', machine: 'db-admin-ws', terminal: 'pts/2' },
  ],
  activeSessionsHistory: generateTimeSeries(24, 20, 5),
  alertLog: [
    { id: "alert1", timestamp: formatISO(subHours(now, 1)), error_code: "ORA-00600: internal error code" },
  ],
  diskUsage: [
    { mount_point: "/", total_gb: 200, used_gb: 150, used_percent: 75 },
    { mount_point: "/u01", total_gb: 500, used_gb: 460, used_percent: 92 },
  ],
  topWaitEvents: generateWaitEvents(15),
  standbyStatus: [
    { name: "Standby", status: "SYNCHRONIZED", transport_lag: "0.00", apply_lag: "0.00", mrp_status: "APPLYING_LOG", sequence: 12345, apply_rate_mb_s: 15.6 },
  ],
  customers: [],
};

const demoDb2: DashboardData = {
    ...demoDb1,
    id: "demo2",
    dbName: "DEMO_STANDBY",
    dbStatus: "MOUNTED",
    kpis: {
      cpuUsage: 5.1,
      memoryUsage: 40.2,
      activeSessions: 2,
    },
    performance: {
        cpu: generateTimeSeries(24, 15, 2),
        memory: generateTimeSeries(24, 45, 35),
        io_read: generateIoTimeSeries(24).read,
        io_write: generateIoTimeSeries(24).write,
        network_up: generateTimeSeries(24, 1, 0),
        network_down: generateTimeSeries(24, 2, 0),
    },
    tablespaces: [],
    detailedActiveSessions: [],
    alertLog: [],
    topWaitEvents: [],
    standbyStatus: []
};


export const DEMO_DATA_PAYLOAD: ServerDataPayload = {
    "demo1": {
        data: demoDb1,
        last_updated: formatISO(now),
    },
    "demo2": {
        data: demoDb2,
        last_updated: formatISO(now),
    }
};
