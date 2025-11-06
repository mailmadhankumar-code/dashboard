
import nodemailer from 'nodemailer';
import { Settings, DashboardData } from '@/lib/types';

// In-memory store to track the last time an alert was sent for a specific issue
// Key: [server_id, alert_type, item_name], Value: { timestamp: Date, last_status: 'ok' | 'alert' }
const alert_debounce_store: { [key: string]: { timestamp: Date, last_status: 'ok' | 'alert' } } = {};

// --- Debounce Configuration in Minutes ---
const STATUS_DEBOUNCE_MINUTES = 3 * 60; // 3 hours
const DAILY_DEBOUNCE_MINUTES = 24 * 60; // 24 hours


const SMTP_CONFIG = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: (process.env.SMTP_PORT || "587") === "465", // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
};
const SMTP_SENDER = process.env.SMTP_SENDER || "noreply@proactivedb.com";

// --- Cleanup Configuration for Debounce Store ---
const DEBOUNCE_CLEANUP_INTERVAL_HOURS = 6;
const DEBOUNCE_STALE_THRESHOLD_HOURS = 48; // Entries older than this will be removed

function cleanupStaleDebounceEntries() {
  const now = new Date();
  let cleaned_count = 0;
  console.log(`[AlertManager] Running cleanup of stale debounce entries...`);
  for (const key in alert_debounce_store) {
    if (Object.prototype.hasOwnProperty.call(alert_debounce_store, key)) {
      const entry = alert_debounce_store[key];
      const diffHours = (now.getTime() - entry.timestamp.getTime()) / (1000 * 60 * 60);
      if (diffHours > DEBOUNCE_STALE_THRESHOLD_HOURS) {
        delete alert_debounce_store[key];
        cleaned_count++;
      }
    }
  }
  if (cleaned_count > 0) {
      console.log(`[AlertManager] Cleaned up ${cleaned_count} stale debounce entries.`);
  }
}

// Start a periodic cleanup task for the debounce store
if (process.env.NODE_ENV !== 'test') { // Don't run timers in test environments
    setInterval(cleanupStaleDebounceEntries, DEBOUNCE_CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000);
    // Run once on startup as well
    cleanupStaleDebounceEntries();
}


export class AlertManager {
    public settings: Settings;
    private transporter: nodemailer.Transporter;

    constructor(settings: Settings) {
        this.settings = settings;
        if(SMTP_CONFIG.host) {
            this.transporter = nodemailer.createTransport(SMTP_CONFIG);
        } else {
            // Create a dummy transporter if no host is configured
            this.transporter = nodemailer.createTransport({jsonTransport: true});
        }
    }

    private _can_send_alert(server_id: string, alert_type: string, item_name: string | number, is_alert_condition: boolean, debounce_minutes: number): boolean {
        const key = `${server_id}|${alert_type}|${String(item_name)}`;
        const now = new Date();
        const current_status = is_alert_condition ? 'alert' : 'ok';
        
        const last_alert = alert_debounce_store[key];

        // Case 1: No previous alert for this key.
        if (!last_alert) {
            if (is_alert_condition) {
                console.log(`New alert condition for ${key}. Sending alert.`);
                alert_debounce_store[key] = { timestamp: now, last_status: 'alert' };
                return true; // Send alert
            } else {
                // Condition is fine, no need to do anything.
                return false;
            }
        }

        const last_alert_time = last_alert.timestamp;
        const last_status = last_alert.last_status;
        const diffMinutes = (now.getTime() - last_alert_time.getTime()) / (1000 * 60);

        // Case 2: Condition has changed from OK to ALERT.
        if (is_alert_condition && last_status === 'ok') {
             console.log(`Alert condition for ${key} has re-appeared. Sending alert.`);
             alert_debounce_store[key] = { timestamp: now, last_status: 'alert' };
             return true;
        }
        
        // Case 3: Condition is ALERT, but was also ALERT before. Check debounce period.
        if (is_alert_condition && last_status === 'alert') {
            if (diffMinutes < debounce_minutes) {
                console.log(`Debouncing alert for ${key}. Last alert was ${diffMinutes.toFixed(1)} mins ago.`);
                return false; // Debounced
            } else {
                console.log(`Debounce period for ${key} has passed. Sending follow-up alert.`);
                alert_debounce_store[key] = { timestamp: now, last_status: 'alert' };
                return true; // Send alert
            }
        }
        
        // Case 4: Condition is now OK. Update status so we can alert if it fails again.
        if (!is_alert_condition) {
            if(last_status === 'alert') {
                console.log(`Alert condition for ${key} has cleared.`);
                alert_debounce_store[key] = { ...last_alert, last_status: 'ok' };
            } else {
                // If it was already ok, just update the timestamp to keep the entry from getting stale
                alert_debounce_store[key] = { ...last_alert, timestamp: now };
            }
        }

        return false; // Don't send in all other cases
    }

    private async _send_email(subject: string, body: string, recipients: string[]) {
        if (!SMTP_CONFIG.host || recipients.length === 0) {
            console.log("SMTP not configured or no recipients, skipping email.");
            console.log(`Subject: ${subject}\nBody: ${body}`);
            return;
        }

        const mailOptions = {
            from: SMTP_SENDER,
            to: recipients.join(', '),
            subject: subject,
            text: body,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`Successfully sent alert email to: ${recipients.join(', ')}`, info.response);
        } catch (error: any) {
             if (error.code === 'ECONNREFUSED') {
                console.error(`\n--- SMTP Connection Error ---`);
                console.error(`Failed to connect to SMTP server at ${error.address}:${error.port}.`);
                console.error(`This 'ECONNREFUSED' error means the connection was rejected. Please check the following:`);
                console.error(`1. Verify the SMTP_HOST and SMTP_PORT in your .env.local file are correct.`);
                console.error(`2. Ensure no firewall is blocking outbound connections on port ${error.port}.`);
                console.error(`3. Confirm your SMTP server is running and accessible.`);
                console.error(`---------------------------\n`);
            } else {
                console.error(`Failed to send email: ${error}`);
            }
        }
    }

    async process_alerts(server_id: string, data: DashboardData) {
        console.log(`Processing alerts for ${server_id}...`);
        
        const db_name = data.dbName || "N/A";
        
        const email_settings = this.settings.emailSettings || {};
        
        // All alerts go to admins
        const admin_emails = email_settings.adminEmails || [];
        const all_recipients = new Set<string>(admin_emails);
        
        // Find customer emails from settings and add them
        for (const cust of (email_settings.customers || [])) {
            if (cust.databases?.some(db => db.id === server_id)) {
                const customer_emails = cust.emails || [];
                if (customer_emails.length > 0) {
                    customer_emails.forEach(email => all_recipients.add(email));
                }
                break;
            }
        }
        
        const recipientsList = Array.from(all_recipients).filter(Boolean);
        
        // --- Check all alert conditions ---
        await this._check_status_alerts(server_id, db_name, data, recipientsList);
        await this._check_threshold_alerts(server_id, db_name, data, recipientsList);
        await this._check_ora_error_alerts(server_id, db_name, data, recipientsList);
        await this._check_backup_alerts(server_id, db_name, data, recipientsList);
    }

    private async _check_status_alerts(server_id: string, db_name: string, data: DashboardData, recipients: string[]) {
        if (this._can_send_alert(server_id, "status", "db_down", !data.dbIsUp, STATUS_DEBOUNCE_MINUTES)) {
            const subject = `ALERT: Database Down for ${db_name} (${server_id})`;
            const body = `The database ${db_name} (${server_id}) is currently unreachable.`;
            await this._send_email(subject, body, recipients);
        }
        
        if (this._can_send_alert(server_id, "status", "os_down", !data.osIsUp, STATUS_DEBOUNCE_MINUTES)) {
            const subject = `ALERT: OS Unreachable for ${db_name} (${server_id})`;
            const body = `The operating system for server hosting ${db_name} (${server_id}) is not reporting data.`;
            await this._send_email(subject, body, recipients);
        }
    }

    private async _check_threshold_alerts(server_id: string, db_name: string, data: DashboardData, recipients: string[]) {
        const thresholds = this.settings.thresholds || { cpu: 90, memory: 90 };
        const exclusions = this.settings.alertExclusions || {};
        const kpis = data.kpis || { cpuUsage: 0, memoryUsage: 0, activeSessions: 0 };

        // CPU
        if (thresholds.cpu) {
            const isAlert = kpis.cpuUsage > thresholds.cpu;
            if (this._can_send_alert(server_id, "threshold", "cpu", isAlert, DAILY_DEBOUNCE_MINUTES)) {
                const subject = `ALERT: High CPU Usage on ${db_name} (${server_id})`;
                const body = `CPU usage is currently at ${kpis.cpuUsage.toFixed(2)}%, exceeding the threshold of ${thresholds.cpu}%.`;
                await this._send_email(subject, body, recipients);
            }
        }

        // Memory
        if (thresholds.memory) {
            const isAlert = kpis.memoryUsage > thresholds.memory;
            if (this._can_send_alert(server_id, "threshold", "memory", isAlert, DAILY_DEBOUNCE_MINUTES)) {
                const subject = `ALERT: High Memory Usage on ${db_name} (${server_id})`;
                const body = `Memory usage is currently at ${kpis.memoryUsage.toFixed(2)}%, exceeding the threshold of ${thresholds.memory}%.`;
                await this._send_email(subject, body, recipients);
            }
        }

        // Disk Usage
        const disk_threshold = this.settings.diskThreshold || 90;
        const excluded_disks = exclusions.excludedDisks || [];
        for (const disk of (data.diskUsage || [])) {
            if (excluded_disks.includes(disk.mount_point)) {
                continue; // Skip excluded disk
            }
            const isAlert = disk.used_percent > disk_threshold;
            if (this._can_send_alert(server_id, "threshold", `disk_${disk.mount_point}`, isAlert, DAILY_DEBOUNCE_MINUTES)) {
                const subject = `ALERT: High Disk Usage on ${db_name} (${server_id})`;
                const body = `Disk usage for mount point '${disk.mount_point}' is at ${disk.used_percent.toFixed(2)}%, exceeding the threshold of ${disk_threshold}%.`;
                await this._send_email(subject, body, recipients);
            }
        }

        // Tablespace Usage
        const ts_threshold = this.settings.tablespaceThreshold || 90;
        for (const ts of (data.tablespaces || [])) {
            const isAlert = ts.used_percent > ts_threshold;
             if (this._can_send_alert(server_id, "threshold", `ts_${ts.name}`, isAlert, DAILY_DEBOUNCE_MINUTES)) {
                const subject = `ALERT: High Tablespace Usage in ${db_name} (${server_id})`;
                const body = `Tablespace '${ts.name}' usage is at ${ts.used_percent.toFixed(2)}%, exceeding the threshold of ${ts_threshold}%.`;
                await this._send_email(subject, body, recipients);
             }
        }
    }

    private async _check_ora_error_alerts(server_id: string, db_name: string, data: DashboardData, recipients: string[]) {
        const exclusions = this.settings.alertExclusions || {};
        const excluded_errors = exclusions.excludedOraErrors || [];

        const filtered_logs = (data.alertLog || []).filter(log => 
            !excluded_errors.some(prefix => log.error_code.startsWith(prefix))
        );

        const hasOraErrors = filtered_logs.length > 0;

        if (this._can_send_alert(server_id, "ora_error", "consolidated", hasOraErrors, DAILY_DEBOUNCE_MINUTES)) {
            const subject = `ALERT: New ORA- Error(s) Detected in ${db_name} (${server_id})`;
            let body = `New ORA- errors were found in the alert log for ${db_name} (${server_id}).\n\n`;
            body += "Recent errors:\n";
            filtered_logs.slice(0, 10).forEach(log_entry => {
                body += `- ${log_entry.timestamp}: ${log_entry.error_code}\n`;
            });
            if (filtered_logs.length > 10) {
                body += `\n...and ${filtered_logs.length - 10} more.`;
            }
            await this._send_email(subject, body, recipients);
        }
    }
    
    private async _check_backup_alerts(server_id: string, db_name: string, data: DashboardData, recipients: string[]) {
        for (const backup of (data.backups || [])) {
            if (backup.status === 'FAILED') {
                if (this._can_send_alert(server_id, "backup_failed", backup.id, true, DAILY_DEBOUNCE_MINUTES)) {
                    const subject = `ALERT: RMAN Backup Failed for ${db_name} (${server_id})`;
                    const body = `An RMAN backup job for ${db_name} started at ${backup.start_time} has FAILED.`;
                    await this._send_email(subject, body, recipients);
                }
            }
        }
    }
}
