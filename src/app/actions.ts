"use server";

import { getSession } from '@/lib/server/session';
import { getSettings } from '@/lib/server/settings';
import { db_data_store } from '@/lib/server/db';
import type { OverviewRow, Settings, ApiDataResponse } from '@/lib/types';

const STATUS_TIMEOUT_SECONDS = 90;

export async function getOverviewData(): Promise<{ error?: string; data?: OverviewRow[] }> {
    try {
        const session = await getSession();
        if (!session) {
            return { error: 'Unauthorized' };
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
                        uptime: data.osInfo?.uptime ?? "N/A",
                    };
                } else {
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
                        uptime: "N/A",
                    };
                }
                overviewData.push(rowData);
            }
        }

        return { data: overviewData };

    } catch (error) {
        console.error("Error in getOverviewData:", error);
        return { error: 'Internal Server Error' };
    }
}

export async function getSettingsAction(): Promise<{ error?: string; data?: Settings }> {
    try {
        const settings = await getSettings();
        return { data: settings };
    } catch (error) {
        console.error("Error in getSettingsAction:", error);
        return { error: 'Internal Server Error' };
    }
}

export async function getDashboardDataAction(dbId: string): Promise<{ error?: string; data?: ApiDataResponse }> {
    try {
        const session = await getSession();
        if (!session) {
            return { error: 'Unauthorized' };
        }

        const settings = await getSettings();
        const allCustomers = settings.emailSettings?.customers || [];
        const userDbIds = new Set(
            (session.role === 'admin'
                ? allCustomers
                : allCustomers.filter(c => session.customerIds?.includes(c.id))
            ).flatMap(c => c.databases.map(db => db.id))
        );

        if (!userDbIds.has(dbId)) {
             return { error: 'Forbidden' };
        }

        const serverSnapshot = db_data_store[dbId];
        const now = new Date();

        if (serverSnapshot && (now.getTime() - new Date(serverSnapshot.last_updated).getTime()) / 1000 <= STATUS_TIMEOUT_SECONDS) {
            return { data: serverSnapshot.data };
        } else {
            return { error: 'Data not available or outdated.' };
        }

    } catch (error) {
        console.error(`Error in getDashboardDataAction for dbId ${dbId}:`, error);
        return { error: 'Internal Server Error' };
    }
}
