
import { NextResponse } from "next/server";
import { db_data_store } from "@/lib/server/db";
import { getSettings } from "@/lib/server/settings";

const STATUS_TIMEOUT_SECONDS = 90;

// This is a new, lightweight endpoint to get only the status of all servers.
// It's used by the frontend to efficiently update the status indicators in the sidebar
// without fetching all the heavy performance data.
export async function GET() {
    const statusPayload: { [key: string]: { dbIsUp: boolean; osIsUp: boolean } } = {};
    const now = new Date();

    // 1. Get all configured databases from settings to have a complete list
    const settings = await getSettings();
    const allConfiguredDbs = settings.emailSettings?.customers?.flatMap(c => c.databases) || [];

    // 2. Iterate through all configured databases
    for (const db of allConfiguredDbs) {
        const server_id = db.id;
        const server_snapshot = db_data_store[server_id];

        if (server_snapshot && server_snapshot.data) {
            // 3. Check if the last update was within the timeout period
            const lastUpdated = new Date(server_snapshot.last_updated);
            const secondsSinceUpdate = (now.getTime() - lastUpdated.getTime()) / 1000;

            if (secondsSinceUpdate > STATUS_TIMEOUT_SECONDS) {
                 // If data is stale, report as down
                 statusPayload[server_id] = {
                    dbIsUp: false,
                    osIsUp: false,
                };
            } else {
                // If data is fresh, use its reported status
                statusPayload[server_id] = {
                    dbIsUp: server_snapshot.data.dbIsUp,
                    osIsUp: server_snapshot.data.osIsUp,
                };
            }
        } else {
             // 4. If no snapshot exists in memory at all, it's down
             statusPayload[server_id] = {
                dbIsUp: false,
                osIsUp: false,
            };
        }
    }
   
    return NextResponse.json(statusPayload);
}

    
