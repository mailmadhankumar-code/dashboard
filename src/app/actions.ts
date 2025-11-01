
"use server";

import { getSession } from '@/lib/server/session';
import { getSettings } from '@/lib/server/settings';
import { getAllServerIds, getLatestServerData } from '@/lib/server/db';
import type { OverviewRow, Settings, DashboardData, Customer, Database } from '@/lib/types';

/**
 * Builds the overview page by fetching the latest data for all servers from the database.
 */
export async function getOverviewData(): Promise<{ error?: string; data?: OverviewRow[] }> {
    try {
        const session = await getSession();
        if (!session) {
            return { error: 'Unauthorized' };
        }

        const allServers = await getAllServerIds();

        const overviewData: OverviewRow[] = [];

        for (const server of allServers) {
            const serverData = await getLatestServerData(server.id);
            
            let rowData: OverviewRow;

            if (serverData) {
                 rowData = {
                    id: serverData.id,
                    dbName: serverData.dbName,
                    // Customer name is not stored per server, so we leave it blank for now.
                    // This could be added to the server data if needed.
                    customerName: "", 
                    dbIsUp: serverData.dbIsUp,
                    osIsUp: serverData.osIsUp,
                    dbStatus: serverData.dbStatus,
                    cpuUsage: serverData.kpis?.cpuUsage ?? 0,
                    memoryUsage: serverData.kpis?.memoryUsage ?? 0,
                    activeSessions: serverData.kpis?.activeSessions ?? 0,
                    uptime: serverData.osInfo?.uptime ?? "N/A",
                };
            } else {
                // Create a default row for a server that exists but has no data yet
                rowData = {
                    id: server.id,
                    dbName: server.dbName,
                    customerName: "",
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

        return { data: overviewData };

    } catch (error) {
        console.error("Error in getOverviewData:", error);
        return { error: 'Internal Server Error' };
    }
}

/**
 * Fetches the application-wide settings.
 */
export async function getSettingsAction(): Promise<{ error?: string; data?: Settings }> {
    try {
        const settings = await getSettings();
        return { data: settings };
    } catch (error) {
        console.error("Error in getSettingsAction:", error);
        return { error: 'Internal Server Error' };
    }
}

/**
 * Fetches the complete, latest data snapshot for a specific dashboard from the database.
 */
export async function getDashboardDataAction(dbId: string): Promise<{ error?: string; data?: DashboardData }> {
    try {
        const session = await getSession();
        if (!session) {
            return { error: 'Unauthorized' };
        }

        // TODO: Add authorization check to ensure the user can view this dbId

        const serverData = await getLatestServerData(dbId);

        if (serverData) {
            return { data: serverData };
        } else {
            return { error: 'Data not available for this server.' };
        }

    } catch (error) {
        console.error(`Error in getDashboardDataAction for dbId ${dbId}:`, error);
        return { error: 'Internal Server Error' };
    }
}

/**
 * Fetches the list of all customers and their associated databases with their current status.
 * This is used to populate the sidebar.
 */
export async function getCustomersAction(): Promise<{ error?: string; data?: Customer[] }> {
    try {
        const session = await getSession();
        if (!session) {
            return { error: 'Unauthorized' };
        }

        const settings = await getSettings();
        const emailCustomers = settings.emailSettings?.customers;

        if (!emailCustomers) {
            // Return empty array if no customers are defined in settings
            return { data: [] };
        }

        // Get the status for all databases to enrich the customer data
        const overviewResult = await getOverviewData();
        if (overviewResult.error || !overviewResult.data) {
            return { error: 'Could not fetch database statuses to populate customer list.' };
        }

        const dbStatusMap = new Map<string, OverviewRow>(overviewResult.data.map(db => [db.id, db]));

        const customers: Customer[] = emailCustomers.map(customer => ({
            id: customer.id,
            name: customer.name,
            emails: customer.emails,
            databases: customer.databases.map(db => {
                const status = dbStatusMap.get(db.id);
                return {
                    id: db.id,
                    name: db.name,
                    isUp: status?.dbIsUp ?? false,
                    osUp: status?.osUp ?? false,
                };
            }),
        }));

        return { data: customers };

    } catch (error) {
        console.error("Error in getCustomersAction:", error);
        return { error: 'Internal Server Error' };
    }
}
