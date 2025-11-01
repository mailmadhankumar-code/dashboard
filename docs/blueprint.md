# **App Name**: ProactiveDB Insights

## Core Features:

- DB Status Monitoring: Monitor the real-time status (up/down) of Oracle databases across Linux and Windows platforms.
- Performance Dashboards: Display key performance indicators (KPIs) like Top Wait Events, active session counts, CPU & Memory usage (%), I/O, and network usage.
- Historical Charting: Visualize performance data over the last 7 days with interactive charts for key metrics. LLM tool detects anomalies in historical data, aiding in predictive analysis. Display active sessions list.
- Alert Log Analysis: Parse and display Oracle alert log errors from V$DIAG_ALERT_EXT for the last 7 days.
- RMAN Status Tracking: Monitor the status of RMAN backups for the last 7 days, providing visual indicators of success or failure.
- Tablespace Monitoring: Display tablespace details with maxbytes calculation, sorted by usage (descending) with visual indicators.
- Email Alerting: Configure email alerts for high CPU, memory, I/O, tablespace usage, ORA errors, network issues, and DB/OS downtime or unreachability.

## Style Guidelines:

- Primary color: Deep purple (#673AB7) to evoke a sense of reliability and sophistication, fitting for database monitoring.
- Background color: Dark grey (#212121), complementing the dark theme with a muted base.
- Accent color: Electric blue (#29ABE2) for interactive elements and highlights, providing a clear visual distinction.
- Body and headline font: 'Inter', a grotesque-style sans-serif font known for its modern and neutral appearance, suitable for both headlines and body text.
- Code font: 'Source Code Pro' for displaying configuration details or SQL queries.
- Glassmorphism UI with subtle gradients, shadows, and glossy elements to achieve a modern and visually appealing interface. Left side panel for database navigation.
- Smooth transitions and subtle animations for real-time updates and user interactions. All individual components refresh automatically live.