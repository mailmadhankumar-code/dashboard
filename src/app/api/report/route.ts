
import { NextResponse } from "next/server";
import { getSettings } from "@/lib/server/settings";
import { storePerformanceMetrics, updateServerData, getDb } from "@/lib/server/db";
import { DashboardData } from "@/lib/types";


export async function POST(request: Request) {
  try {
    // Initialize the database connection (this will also create and seed the DB if it doesn't exist)
    await getDb();
    
    const raw_data = (await request.json());
    
    // --- Data Type Coercion ---
    // Ensure numeric fields are correctly typed, especially from JSON
    const data: DashboardData = {
        ...raw_data,
        dbUptime: raw_data.dbUptime || "N/A",
        backups: (raw_data.backups || []).map((b: any) => ({
            ...b,
            input_bytes: b.input_bytes ? Number(b.input_bytes) : 0,
            output_bytes: b.output_bytes ? Number(b.output_bytes) : 0,
            elapsed_seconds: b.elapsed_seconds ? Number(b.elapsed_seconds) : 0,
        }))
    };
    
    const server_id = data.id;
    const timestamp = data.timestamp;

    if (!server_id || !timestamp) {
      return NextResponse.json(
        { error: "Missing 'id' or 'timestamp' in payload" },
        { status: 400 }
      );
    }
    
    // --- Update Server Data in SQLite ---
    await updateServerData(server_id, data);

    // --- Store historical performance data in SQLite ---
    await storePerformanceMetrics(server_id, timestamp, data);
    
    // --- Process Alerts (optional) ---
    // const settings = await getSettings();
    // const alertManager = new AlertManager(settings);
    // await alertManager.process_alerts(server_id, data);
    
    console.log(`[${new Date().toISOString()}] Received data from agent: ${server_id}`);
    return NextResponse.json({ status: "success", id: server_id }, { status: 201 });

  } catch (error) {
    console.error("Error processing report:", error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: "Request must be JSON" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
