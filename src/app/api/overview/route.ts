
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { getSettings } from '@/lib/server/settings';
import { db_data_store } from '@/lib/server/db';
import type { OverviewRow } from '@/lib/types';

const STATUS_TIMEOUT_SECONDS = 90;

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const settings = await getSettings();
        const allCustomers = settings.emailSettings?.customers || [];

        const userCustomers = session.role === 'admin'
            ? allCustomers
            : allCustomers.filter(c => session.customerIds?.includes(c.id));
        
        const userDbIds = new Set(userCustomers.flatMap(c => c.databases.map(db => db.id)));

        const overviewData: OverviewRow[] = [];
        const now = new Date();

        for (const customer of userCustomers) {
            for (const db of customer.databases) {
                const serverId = db.id;
                if (!userDbIds.has(serverId)) continue;

                const serverSnapshot = db_data_store[serverId];
                
                let rowData: OverviewRow;

                if (serverSnapshot && (now.getTime() - new Date(serverSnapshot.last_updated).getTime()) / 1000 <= STATUS_TIMEOUT_SECONDS) {
                    // Data is fresh
                    const data = serverSnapshot.data;
                    rowData = {
                        id: data.id,
                        dbName: data.dbName,
                        customerName: customer.name,
                        dbIsUp: data.dbIsUp,
                        osIsUp: data.osIsUp,
                        dbStatus: data.dbStatus,
                        cpuUsage: data.kpis.cpuUsage,
                        memoryUsage: data.kpis.memoryUsage,
                        activeSessions: data.kpis.activeSessions,
                    };
                } else {
                    // Data is stale or non-existent, report as down
                    rowData = {
                        id: serverId,
                        dbName: db.name,
                        customerName: customer.name,
                        dbIsUp: false,
                        osIsUp: false,
                        dbStatus: 'UNKNOWN',
                        cpuUsage: 0,
                        memoryUsage: 0,
                        activeSessions: 0,
                    };
                }
                overviewData.push(rowData);
            }
        }

        return NextResponse.json(overviewData);

    } catch (error) {
        console.error("Error in /api/overview:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
