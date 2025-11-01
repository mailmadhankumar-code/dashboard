
import { subDays, subHours, formatISO } from "date-fns";
import { 
    DashboardData, 
    Kpi, 
    IoDetail, 
    TimeSeriesData, 
    PerformanceData, 
    Tablespace, 
    RmanBackup, 
    ActiveSession, 
    DetailedActiveSession, 
    AlertLogEntry, 
    DiskUsage, 
    WaitEvent, 
    StandbyStatus, 
    Customer, 
    OsInfo,
    ProcessInfo
} from "@/lib/types";

// ================================================================================
// MOCK DATA GENERATION
// ================================================================================

const generateRandom = (min: number, max: number) => Math.random() * (max - min) + min;
const generateInteger = (min: number, max: number) => Math.floor(generateRandom(min, max));

const mockProcessList = (count: number): ProcessInfo[] => {
    const processes: ProcessInfo[] = [];
    for (let i = 0; i < count; i++) {
        processes.push({
            pid: generateInteger(1000, 9999),
            user: 'oracle',
            cpu_percent: generateRandom(0.1, 5.0),
            memory_percent: generateRandom(0.5, 3.0),
            command: `oracle@db (LOCAL=NO) -background-p${i}`
        });
    }
    return processes.sort((a, b) => b.cpu_percent - a.cpu_percent);
};

const mockOsInfo = (): OsInfo => ({
    platform: "Linux",
    release: "x86_64",
    uptime: `${generateInteger(10, 365)}d ${generateInteger(0, 23)}h ${generateInteger(0, 59)}m`,
    totalCpu: 16,
    totalMemory: 128,
    topCpuProcesses: mockProcessList(5),
    topMemoryProcesses: mockProcessList(5),
    topNetworkProcesses: [],
});

const mockKpis = (): Kpi => ({
    cpuUsage: generateRandom(10, 80),
    memoryUsage: generateRandom(20, 90),
    activeSessions: generateInteger(5, 50),
    memoryUsedGB: generateRandom(25, 110),
    memoryTotalGB: 128
});

const mockIoDetails = (): IoDetail[] => [
    { device: 'sda', mount_point: '/u01', read_mb_s: generateRandom(1, 10), write_mb_s: generateRandom(0, 5) },
    { device: 'sdb', mount_point: '/data', read_mb_s: generateRandom(5, 50), write_mb_s: generateRandom(2, 20) },
];

const mockTimeSeries = (hours: number, generator: () => number): TimeSeriesData[] => {
    const data: TimeSeriesData[] = [];
    const now = new Date();
    for (let i = hours; i >= 0; i--) {
        data.push({ date: subHours(now, i).toISOString(), value: generator() });
    }
    return data;
};

const mockPerformanceData = (): PerformanceData => ({
    cpu: mockTimeSeries(24, () => generateRandom(10, 80)),
    memory: mockTimeSeries(24, () => generateRandom(20, 90)),
    io_read: mockTimeSeries(24, () => generateRandom(1, 10)),
    io_write: mockTimeSeries(24, () => generateRandom(0, 5)),
    network_up: mockTimeSeries(24, () => generateRandom(0, 2)),
    network_down: mockTimeSeries(24, () => generateRandom(0, 1)),
});

const mockTablespaces = (): Tablespace[] => [
    { name: 'SYSTEM', total_gb: 10, used_gb: generateRandom(5, 8), used_percent: generateRandom(50, 80) },
    { name: 'SYSAUX', total_gb: 8, used_gb: generateRandom(4, 7), used_percent: generateRandom(50, 90) },
    { name: 'USERS', total_gb: 50, used_gb: generateRandom(10, 45), used_percent: generateRandom(20, 90) },
    { name: 'DATA_TS', total_gb: 200, used_gb: generateRandom(100, 180), used_percent: generateRandom(50, 90) },
];

const mockBackups = (): RmanBackup[] => {
    const backups: RmanBackup[] = [];
    const now = new Date();
    for (let i = 0; i < 5; i++) {
        const startTime = subDays(now, i);
        backups.push({
            id: `backup_${i}`,
            db_name: 'PRODDB',
            start_time: startTime.toISOString(),
            end_time: new Date(startTime.getTime() + generateInteger(600, 3600) * 1000).toISOString(),
            status: i === 1 ? 'FAILED' : 'COMPLETED',
            input_bytes: generateInteger(1e11, 5e11),
            output_bytes: generateInteger(1e10, 5e10),
            elapsed_seconds: generateInteger(600, 3600)
        });
    }
    return backups;
};

const mockActiveSessions = (): ActiveSession[] => [
    { sid: generateInteger(100, 200), username: 'SYS', program: 'oracle@db-host' },
    { sid: generateInteger(201, 300), username: 'APP_USER', program: 'JDBC Thin Client' },
    { sid: generateInteger(301, 400), username: 'REPORT_USER', program: 'SQL Developer' },
];

const mockDetailedActiveSessions = (): DetailedActiveSession[] => [
    { inst: 1, sid: 123, username: 'APP_USER', sql_id: 'a1b2c3d4e5f6', status: 'ACTIVE', event: 'db file sequential read', et: 120, obj: 12345, bs: 8192, bi: 10, module: 'ORDER_ENTRY', machine: 'app-server-1', terminal: 'pts/1' },
    { inst: 1, sid: 456, username: 'REPORT_USER', sql_id: 'f6e5d4c3b2a1', status: 'INACTIVE', event: 'SQL*Net message from client', et: 300, obj: 0, bs: 0, bi: 0, module: 'SQL_DEV', machine: 'report-workstation', terminal: 'pts/2' },
];

const mockAlertLog = (): AlertLogEntry[] => [
    { id: '1', timestamp: subHours(new Date(), 2).toISOString(), error_code: 'ORA-00600' },
    { id: '2', timestamp: subHours(new Date(), 5).toISOString(), error_code: 'ORA-07445' },
    { id: '3', timestamp: subHours(new Date(), 10).toISOString(), error_code: 'ORA-01578' },
];

const mockDiskUsage = (): DiskUsage[] => [
    { mount_point: '/', total_gb: 50, used_gb: generateRandom(10, 20), used_percent: generateRandom(20, 40) },
    { mount_point: '/u01', total_gb: 100, used_gb: generateRandom(70, 95), used_percent: generateRandom(70, 95) },
    { mount_point: '/data', total_gb: 500, used_gb: generateRandom(300, 450), used_percent: generateRandom(60, 90) },
];

const mockWaitEvents = (): WaitEvent[] => [
    { event: 'db file sequential read', value: generateInteger(10, 100) },
    { event: 'log file sync', value: generateInteger(5, 50) },
    { event: 'library cache lock', value: generateInteger(1, 10) },
];

const mockStandbyStatus = (): StandbyStatus[] => [
    { name: 'STANDBYDB', status: 'SYNCHRONIZED', transport_lag: '00:00:00', apply_lag: '00:00:01', mrp_status: 'APPLYING', sequence: 12345, apply_rate_mb_s: generateRandom(10, 50) },
];

const mockCustomers: Customer[] = [
    {
        id: 'customer-1',
        name: 'ACME Corporation',
        databases: [
            { id: 'prod-db-1', name: 'PRODDB', isUp: true, osUp: true, osType: 'Linux' },
            { id: 'dev-db-1', name: 'DEVDB', isUp: true, osUp: false, osType: 'Linux' },
        ]
    },
    {
        id: 'customer-2',
        name: 'Cyberdyne Systems',
        databases: [
            { id: 't800-db', name: 'SKYNETDB', isUp: false, osUp: false, osType: 'Unknown' },
        ]
    }
];

export const generateMockDashboardData = (serverId: string, dbName: string): DashboardData => {
    const now = new Date();
    const isUp = Math.random() > 0.1; // 90% chance of being up
    return {
        id: serverId,
        dbName: dbName,
        timestamp: now.toISOString(),
        dbIsUp: isUp,
        dbStatus: isUp ? 'OPEN' : 'DOWN',
        osIsUp: isUp,
        osInfo: mockOsInfo(),
        kpis: mockKpis(),
        current_performance: {
            cpu: generateRandom(10, 80),
            memory: generateRandom(20, 90),
            io_read: generateRandom(1, 10),
            io_write: generateRandom(0, 5),
            io_details: mockIoDetails(),
            network_up: generateRandom(0, 2),
            network_down: generateRandom(0, 1),
            active_sessions: generateInteger(5, 50)
        },
        performance: mockPerformanceData(),
        tablespaces: mockTablespaces(),
        backups: mockBackups(),
        activeSessions: mockActiveSessions(),
        detailedActiveSessions: mockDetailedActiveSessions(),
        activeSessionsHistory: mockTimeSeries(24, () => generateInteger(5, 50)),
        alertLog: mockAlertLog(),
        diskUsage: mockDiskUsage(),
        topWaitEvents: mockWaitEvents(),
        standbyStatus: mockStandbyStatus(),
        customers: mockCustomers,
    };
};

export const generateHistoricPerformanceData = (serverId: string) => {
    const now = new Date();
    const data = [];
    for (let i = 24 * 365; i >= 0; i--) { // 1 year of data
        const timestamp = subHours(now, i).toISOString();
        data.push({
            server_id: serverId,
            timestamp: timestamp,
            cpu_usage: generateRandom(5, 90),
            memory_usage: generateRandom(10, 95),
            io_read_total: generateRandom(1, 20),
            io_write_total: generateRandom(0, 10),
            network_up: generateRandom(0, 5),
            network_down: generateRandom(0, 2),
            active_sessions: generateInteger(1, 100)
        });
    }
    return data;
}
