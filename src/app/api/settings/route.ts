
import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/server/settings';

export async function GET() {
    const settings = await getSettings();
    return NextResponse.json(settings);
}

export async function POST(request: Request) {
    try {
        const newSettings = await request.json();
        // Simple validation, can be improved
        if (!newSettings || typeof newSettings.tablespaceThreshold === 'undefined' || typeof newSettings.diskThreshold === 'undefined') {
            return NextResponse.json({ error: "Missing required settings" }, { status: 400 });
        }

        const currentSettings = await getSettings();
        if (currentSettings.emailSettings && !newSettings.emailSettings) {
            newSettings.emailSettings = currentSettings.emailSettings;
        }

        await saveSettings(newSettings);
        return NextResponse.json(newSettings, { status: 200 });

    } catch (error) {
        console.error("Error in POST /api/settings:", error);
        if (error instanceof SyntaxError) {
            return NextResponse.json({ error: "Request must be JSON" }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

    