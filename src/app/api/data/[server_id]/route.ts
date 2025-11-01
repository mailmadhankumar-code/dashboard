
import { NextResponse } from "next/server";
import { getPerformanceHistory24h, db_data_store } from "@/lib/server/db";
import { deepCopy } from "@/lib/utils";

export async function GET(
  request: Request,
  { params }: { params: { server_id: string } }
) {
  const awaitedParams = await Promise.resolve(params);
  const server_id = awaitedParams.server_id;
  const server_snapshot = db_data_store[server_id];

  if (!server_snapshot) {
    // If no data exists, return a default "down" state instead of 404.
    // This prevents frontend errors on initial load before the agent reports in.
    const emptyPayload = {
        data: {
            id: server_id,
            dbName: server_id,
            timestamp: new Date().toISOString(),
            dbIsUp: false,
            osIsUp: false,
            dbStatus: "UNKNOWN",
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
        },
        last_updated: new Date().toISOString(),
    };
    return NextResponse.json(emptyPayload);
  }

  // Create a deep copy to avoid modifying the original data
  const response_data = deepCopy(server_snapshot);

  // --- Inject the 24-hour performance history ---
  const performance_history = await getPerformanceHistory24h(server_id);
  
  if (!response_data.data.performance) {
    response_data.data.performance = {};
  }

  response_data.data.performance.cpu = performance_history.cpu || [];
  response_data.data.performance.memory = performance_history.memory || [];
  response_data.data.performance.io_read = performance_history.io_read || [];
  response_data.data.performance.io_write = performance_history.io_write || [];
  response_data.data.performance.network_up = performance_history.network_up || [];
  response_data.data.performance.network_down = performance_history.network_down || [];
  response_data.data.activeSessionsHistory = performance_history.activeSessionsHistory || [];
  response_data.data.topWaitEvents = performance_history.topWaitEvents || [];


  return NextResponse.json(response_data);
}
