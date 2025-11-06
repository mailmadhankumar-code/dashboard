
import fs from 'fs/promises';
import path from 'path';
import { Settings } from '@/lib/types';

// Use path.join to create a platform-independent path
const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

const defaultSettings: Settings = {
    tablespaceThreshold: 90,
    diskThreshold: 90,
    thresholds: {
        cpu: 90,
        memory: 90
    },
    alertExclusions: {
        excludedDisks: [
          "/boot",
          "/var/lib/docker/overlay2"
        ],
        excludedOraErrors: [
          "TNS-"
        ]
    },
    emailSettings: {
        adminEmails: [
            "admin@example.com",
            "secondary.admin@example.com"
        ],
        customers: [
            {
                id: "cust1",
                name: "Global Tech Inc.",
                emails: [
                    "alerts-tech@example.com",
                    "manager-tech@example.com"
                ],
                databases: [
                    { "id": "db1", "name": "PROD_CRM" },
                    { "id": "db2", "name": "DEV_ERP" }
                ]
            },
            {
                id: "cust2",
                name: "Innovate Solutions",
                emails: [
                    "alerts-innovate@example.com"
                ],
                databases: [
                    { "id": "db3", "name": "FINANCE_PROD" },
                    { "id": "db4", "name": "HR_UAT" }
                ]
            }
        ]
    },
    users: [
        {
          "email": "admin@example.com",
          "username": "admin",
          "password": "password",
          "role": "admin"
        },
        {
          "email": "user@example.com",
          "username": "user",
          "password": "password",
          "role": "user",
          "customerIds": ["cust1"]
        }
    ]
};

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function getSettings(): Promise<Settings> {
    if (!(await fileExists(SETTINGS_FILE))) {
        // If the file doesn't exist, create it with default settings
        await saveSettings(defaultSettings);
        return defaultSettings;
    }
    try {
        const fileContent = await fs.readFile(SETTINGS_FILE, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.error("Error reading settings file, returning defaults:", error);
        return defaultSettings;
    }
}

export async function saveSettings(settings: Settings): Promise<void> {
    try {
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (error) {
        console.error("Error saving settings file:", error);
    }
}
