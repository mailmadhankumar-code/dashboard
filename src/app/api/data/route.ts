
import { NextResponse } from "next/server";
import { getPerformanceHistory24h, db_data_store } from "@/lib/server/db";
import { deepCopy } from "@/lib/utils";

// This endpoint is very expensive and should be used sparingly.
// It loads the full 24h history for ALL databases.
// The frontend has been optimized to use /api/data/[server_id] instead for the main dashboard.
export async function GET() {
    // Create a deep copy to avoid modifying the original store
    const full_data = deepCopy(db_data_store);
    
    for (const server_id in full_data) {
        const server_snapshot = full_data[server_id];
        const performance_history = await getPerformanceHistory24h(server_id);
        if (server_snapshot && server_snapshot.data) {
            if (!server_snapshot.data.performance) {
                server_snapshot.data.performance = {};
            }
            server_snapshot.data.performance.cpu = performance_history.cpu || [];
            server_snapshot.data.performance.memory = performance_history.memory || [];
            server_snapshot.data.performance.io_read = performance_history.io_read || [];
            server_snapshot.data.performance.io_write = performance_history.io_write || [];
            server_snapshot.data.performance.network_up = performance_history.network_up || [];
            server_snapshot.data.performance.network_down = performance_history.network_down || [];
            server_snapshot.data.activeSessionsHistory = performance_history.activeSessionsHistory || [];
            server_snapshot.data.topWaitEvents = performance_history.topWaitEvents || [];
        }
    }
   
    return NextResponse.json(full_data);
}

    