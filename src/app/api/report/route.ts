
import { NextResponse } from "next/server";
import { storePerformanceMetrics, updateLatestServerData } from "@/lib/server/db";
import { DashboardData } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const raw_data = (await request.json());
    
    // --- Data Type Coercion ---
    const data: DashboardData = {
        ...raw_data,
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

    // --- Store latest full snapshot in the database ---
    await updateLatestServerData(data);

    // --- Store historical performance data for charts ---
    await storePerformanceMetrics(server_id, timestamp, data);
    
    console.log(`[${new Date().toISOString()}] Successfully processed and stored data for agent: ${server_id}`);
    return NextResponse.json({ status: "success", id: server_id }, { status: 201 });

  } catch (error) {
    console.error("Error processing report:", error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: "Request must be JSON" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
