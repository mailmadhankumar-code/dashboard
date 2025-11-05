
import requests
import json
import time
import platform
from datetime import datetime, timedelta, timezone

# --- Database Connection Configuration ---
# TODO: Replace these placeholders with your actual database credentials.
DB_HOST = "localhost"
DB_PORT = 1521
DB_SERVICE_NAME = "testpdb"
DB_USER = "madhan"
DB_PASSWORD = "madhan123"

# This would typically be constructed from the variables above.
# Example for oracledb library: dsn = f"{DB_HOST}:{DB_PORT}/{DB_SERVICE_NAME}"
DB_CONNECTION_STRING = f"{DB_USER}/{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_SERVICE_NAME}"


# --- Agent & Server Configuration ---
SERVER_URL = "http://127.0.0.1:5173/api/report"
DB_SERVER_ID = "db1"
DB_NAME="PROD_CRM" # Added for better alert identification
FREQUENCY_SECONDS = 10

# --- State for I/O counters ---
# psutil.disk_io_counters returns cumulative values, so we need to store the previous state
# to calculate the rate of change.
previous_io_counters = None
previous_io_timestamp = None
previous_net_io_counters = None
previous_net_io_timestamp = None


def get_db_connection():
    """
    Establishes and returns a database connection.
    This function uses the 'oracledb' library.
    Make sure you have installed it using: pip install oracledb
    """
    try:
        # In a real implementation, you would install the 'oracledb' package:
        # pip install oracledb
        import oracledb
        # The following line enables Thick mode. It requires Oracle Instant Client to be installed.
        # This is often necessary for older database versions (e.g., 11g).
        oracledb.init_oracle_client()
        print(f"Connecting to: {DB_CONNECTION_STRING}")
        connection = oracledb.connect(user=DB_USER, password=DB_PASSWORD, dsn=f"{DB_HOST}:{DB_PORT}/{DB_SERVICE_NAME}")
        print("--- DATABASE CONNECTED ---")
        return connection
    except ImportError:
        print("Error: The 'oracledb' package is not installed. Please install it using 'pip install oracledb'")
        return None
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

def get_psutil():
    """
    Checks for and returns the psutil library.
    Make sure you have installed it using: pip install psutil
    """
    try:
        import psutil
        return psutil
    except ImportError:
        print("Error: The 'psutil' package is not installed. Please install it using 'pip install psutil'")
        return None


def collect_real_data(connection, psutil):
    """
    Executes SQL queries and uses psutil to collect performance metrics.
    """
    global previous_io_counters, previous_io_timestamp, previous_net_io_counters, previous_net_io_timestamp

    print("Collecting real data from database and OS...")
    now = datetime.now(timezone.utc)
    
    # Check if DB connection is truly alive
    db_is_up = False
    if connection:
        try:
            # A lightweight query to check if the connection is active
            cursor_check = connection.cursor()
            cursor_check.execute("SELECT 1 FROM DUAL")
            cursor_check.fetchone()
            db_is_up = True
            cursor_check.close()
        except Exception as e:
            print(f"Database connection check failed: {e}")
            db_is_up = False
    
    cursor = connection.cursor() if db_is_up else None


    # --- OS Info ---
    os_info = None
    if psutil:
        os_info = {
            "platform": platform.system(),
            "release": platform.release()
        }


    # --- Helper function to execute queries ---
    def execute_query(query, params=None):
        if not cursor:
            return []
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            return cursor.fetchall()
        except Exception as e:
            # Check if it's a "table or view does not exist" error
            if "ORA-00942" in str(e):
                print(f"Query failed because a view is not accessible (likely a permissions or licensing issue): {e}")
            else:
                print(f"Error executing query: {e}")
            return [] # Return an empty list on error to prevent crashes


    # --- KPIs (Key Performance Indicators) from OS and DB ---
    kpis = {
        "cpuUsage": 0,
        "memoryUsage": 0,
        "activeSessions": 0,
        "memoryUsedGB": 0,
        "memoryTotalGB": 0
    }
    
    # Get OS-level CPU and Memory from psutil
    if psutil:
        kpis["cpuUsage"] = psutil.cpu_percent(interval=1)
        mem = psutil.virtual_memory()
        kpis["memoryUsage"] = mem.percent
        kpis["memoryUsedGB"] = round(mem.used / (1024**3), 2)
        kpis["memoryTotalGB"] = round(mem.total / (1024**3), 2)

    # Get Active Sessions from Database
    if cursor:
        # This query uses v$session and is compatible with Standard Edition
        kpi_query = """
        SELECT count(*) FROM v$session WHERE status = 'ACTIVE' AND type = 'USER' AND username IS NOT NULL
        """
        kpi_results = execute_query(kpi_query)
        if kpi_results:
           kpis["activeSessions"] = kpi_results[0][0]


    # --- Current Performance Metrics (for history) ---
    io_details = {}
    total_io_read_rate = 0
    total_io_write_rate = 0
    mem_percent = 0
    cpu_usage = kpis["cpuUsage"]
    net_up_rate = 0
    net_down_rate = 0

    if psutil:
        # OS Memory
        mem_info = psutil.virtual_memory()
        mem_percent = mem_info.percent
        
        # OS Disk I/O
        current_io_counters = psutil.disk_io_counters(perdisk=True)
        current_io_timestamp = time.time()
        
        if previous_io_counters is None:
            previous_io_counters = current_io_counters
            previous_io_timestamp = current_io_timestamp
        else:
            time_delta = current_io_timestamp - previous_io_timestamp
            if time_delta > 0:
                for disk, current_stats in current_io_counters.items():
                    if disk in previous_io_counters:
                        prev_stats = previous_io_counters[disk]
                        
                        read_bytes_diff = current_stats.read_bytes - prev_stats.read_bytes
                        write_bytes_diff = current_stats.write_bytes - prev_stats.write_bytes

                        if read_bytes_diff < 0: read_bytes_diff = 0
                        if write_bytes_diff < 0: write_bytes_diff = 0

                        read_rate = read_bytes_diff / time_delta / (1024 * 1024) # MB/s
                        write_rate = write_bytes_diff / time_delta / (1024 * 1024) # MB/s
                        
                        if read_rate > 0.001 or write_rate > 0.001:
                            io_details[disk] = {
                                "read_mb_s": round(read_rate, 2),
                                "write_mb_s": round(write_rate, 2)
                            }
                            total_io_read_rate += read_rate
                            total_io_write_rate += write_rate

            previous_io_counters = current_io_counters
            previous_io_timestamp = current_io_timestamp
        
        # OS Network I/O
        current_net_io_counters = psutil.net_io_counters()
        current_net_io_timestamp = time.time()

        if previous_net_io_counters is None:
            previous_net_io_counters = current_net_io_counters
            previous_net_io_timestamp = current_net_io_timestamp
        else:
            time_delta = current_net_io_timestamp - previous_net_io_timestamp
            if time_delta > 0:
                sent_bytes_diff = current_net_io_counters.bytes_sent - previous_net_io_counters.bytes_sent
                recv_bytes_diff = current_net_io_counters.bytes_recv - previous_net_io_counters.bytes_recv
                
                if sent_bytes_diff < 0: sent_bytes_diff = 0
                if recv_bytes_diff < 0: recv_bytes_diff = 0

                net_up_rate = sent_bytes_diff / time_delta / (1024 * 1024) # MB/s
                net_down_rate = recv_bytes_diff / time_delta / (1024 * 1024) # MB/s

        previous_net_io_counters = current_net_io_counters
        previous_net_io_timestamp = current_net_io_timestamp


    current_performance = {
        "cpu": cpu_usage,
        "memory": mem_percent,
        "io_read": round(total_io_read_rate, 2),
        "io_write": round(total_io_write_rate, 2),
        "io_details": io_details,
        "network_up": round(net_up_rate, 2),
        "network_down": round(net_down_rate, 2),
        "active_sessions": kpis["activeSessions"]
    }


    # --- Tablespaces ---
    tablespaces = []
    if cursor:
        ts_query = """
            SELECT df.tablespace_name,
                round(df.maxbytes / (1024 * 1024 * 1024), 2) max_ts_size_gb,
                round((df.bytes - nvl(sum(fs.bytes),0)) / (1024 * 1024 * 1024), 2) used_ts_size_gb,
                round((df.bytes - nvl(sum(fs.bytes),0)) / (df.maxbytes) * 100, 2) max_ts_pct_used
            FROM dba_free_space fs,
                (select tablespace_name,
                sum(bytes) bytes,
                sum(decode(maxbytes, 0, bytes, maxbytes)) maxbytes,
                max(autoextensible) autoextensible
                from dba_data_files
                group by tablespace_name) df
            WHERE fs.tablespace_name (+) = df.tablespace_name
            GROUP BY df.tablespace_name, df.bytes, df.maxbytes
            UNION ALL
            SELECT df.tablespace_name,
                round(df.maxbytes / (1024 * 1024 * 1024), 2) max_ts_size_gb,
                round((df.bytes - nvl(sum(fs.bytes),0)) / (1024 * 1024 * 1024), 2) used_ts_size_gb,
                round((df.bytes - nvl(sum(fs.bytes),0)) / (df.maxbytes) * 100, 2) max_ts_pct_used
            FROM (select tablespace_name, bytes_used bytes
                from V$temp_space_header
                group by tablespace_name, bytes_free, bytes_used) fs,
                (select tablespace_name,
                sum(bytes) bytes,
                sum(decode(maxbytes, 0, bytes, maxbytes)) maxbytes,
                max(autoextensible) autoextensible
                from dba_temp_files
                group by tablespace_name) df
            WHERE fs.tablespace_name (+) = df.tablespace_name
            GROUP BY df.tablespace_name, df.bytes, df.maxbytes
            ORDER BY 4 DESC
        """
        ts_results = execute_query(ts_query)
        if ts_results:
            for row in ts_results:
                tablespaces.append({
                    "name": row[0],
                    "total_gb": row[1] or 0,
                    "used_gb": row[2] or 0,
                    "used_percent": row[3] or 0
                })

    # --- Backups ---
    backups = []
    if cursor:
        backup_query = """
            SELECT session_key, TO_CHAR(start_time, 'YYYY-MM-DD HH24:MI:SS'), TO_CHAR(end_time, 'YYYY-MM-DD HH24:MI:SS'), status,
                   input_bytes, output_bytes, elapsed_seconds
            FROM V$RMAN_BACKUP_JOB_DETAILS
            WHERE start_time >= SYSDATE - 7
            ORDER BY start_time DESC
        """
        backup_results = execute_query(backup_query)
        if backup_results:
            for row in backup_results:
                backups.append({
                    "id": str(row[0]),
                    "start_time": row[1],
                    "end_time": row[2],
                    "status": row[3],
                    "input_bytes": row[4],
                    "output_bytes": row[5],
                    "elapsed_seconds": row[6],
                    "db_name": DB_NAME
                })


    # --- Active Sessions ---
    activeSessions = []
    if cursor:
        sessions_query = """
            SELECT sid, username, program
            FROM v$session
            WHERE status = 'ACTIVE' AND type != 'BACKGROUND'
            ORDER BY sid
        """
        sessions_results = execute_query(sessions_query)
        if sessions_results:
            for row in sessions_results:
                activeSessions.append({"sid": row[0], "username": row[1], "program": row[2]})

    # --- Detailed Active Sessions ---
    detailedActiveSessions = []
    if cursor:
        detailed_sessions_query = """
            select inst_id, sid, username, sql_id, status, event, last_call_et, row_wait_obj#,
                   BLOCKING_SESSION, BLOCKING_INSTANCE, module, machine, terminal
            from gv$session
            where wait_class !='Idle'
            order by inst_id, event
        """
        detailed_sessions_results = execute_query(detailed_sessions_query)
        if detailed_sessions_results:
            for row in detailed_sessions_results:
                detailedActiveSessions.append({
                    "inst": row[0], "sid": row[1], "username": row[2], "sql_id": row[3],
                    "status": row[4], "event": row[5], "et": row[6], "obj": row[7],
                    "bs": row[8], "bi": row[9], "module": row[10], "machine": row[11],
                    "terminal": row[12]
                })


    # --- Active Sessions History is now collected from snapshots by the backend ---
    # The agent just sends the current number of active sessions.
    activeSessionsHistory = []


    # --- Alert Log ---
    alertLog = []
    if cursor:
        one_hour_ago_utc = datetime.now(timezone.utc) - timedelta(hours=1)
        alert_results = []
        try:
            # First, try the modern V$DIAG_ALERT_EXT view
            alert_log_query_vdiag = """
                SELECT TO_CHAR(ORIGINATING_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS'), MESSAGE_TEXT
                FROM V$DIAG_ALERT_EXT
                WHERE (MESSAGE_TEXT LIKE 'ORA-%' OR MESSAGE_TEXT LIKE 'TNS-%')
                AND ORIGINATING_TIMESTAMP > :1
                ORDER BY ORIGINATING_TIMESTAMP DESC
            """
            alert_results = execute_query(alert_log_query_vdiag, params=[one_hour_ago_utc])
        except Exception as e:
            print(f"Query on V$DIAG_ALERT_EXT failed, will fallback. Error: {e}")

        # Fallback for older Oracle versions or if V$DIAG_ALERT_EXT is not available/accessible
        if not alert_results:
            print("V$DIAG_ALERT_EXT failed or returned no results. Falling back to sys.x$dbgalertext.")
            try:
                alert_log_query_fallback = """
                    SELECT TO_CHAR(ORIGINATING_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS'), message_text
                    FROM sys.x$dbgalertext
                    WHERE (message_text LIKE 'ORA-%' OR message_text LIKE 'TNS-%')
                    AND ORIGINATING_TIMESTAMP > :1
                    ORDER BY ORIGINATING_TIMESTAMP DESC
                """
                alert_results = execute_query(alert_log_query_fallback, params=[one_hour_ago_utc])
            except Exception as e:
                print(f"Could not query alert log fallback (sys.x$dbgalertext may require specific grants): {e}")

        if alert_results:
            for row in alert_results:
                alert_id = f"log_{row[0]}_{hash(row[1])}"
                alertLog.append({"id": alert_id, "timestamp": row[0], "error_code": row[1]})


    # --- Disk Usage (from psutil) ---
    diskUsage = []
    if psutil:
        try:
            for part in psutil.disk_partitions():
                 if 'loop' in part.opts or part.fstype == '':
                    continue
                 usage = psutil.disk_usage(part.mountpoint)
                 diskUsage.append({
                     "mount_point": part.mountpoint,
                     "total_gb": round(usage.total / (1024**3), 2),
                     "used_gb": round(usage.used / (1024**3), 2),
                     "used_percent": usage.percent
                 })
        except Exception as e:
            print(f"Could not get disk usage: {e}")


    # --- Top Wait Events (Real-time from v$session for SE compatibility) ---
    topWaitEvents = []
    if cursor:
        wait_events_query = """
            SELECT event, COUNT(*) as session_count
            FROM v$session
            WHERE wait_class <> 'Idle' AND type = 'USER' AND username IS NOT NULL
            GROUP BY event
            ORDER BY session_count DESC
        """
        wait_results = execute_query(wait_events_query)

        if wait_results:
            for row in wait_results:
                topWaitEvents.append({
                    "event": row[0],
                    "value": row[1]
                })


    if cursor:
        cursor.close()

    # --- Assemble the final data structure ---
    return {
        "id": DB_SERVER_ID,
        "dbName": DB_NAME,
        "timestamp": now.isoformat(),
        "dbIsUp": db_is_up,
        "osIsUp": psutil is not None,
        "osInfo": os_info,
        "kpis": kpis,
        "current_performance": current_performance,
        "tablespaces": tablespaces,
        "backups": backups,
        "activeSessions": activeSessions,
        "detailedActiveSessions": detailedActiveSessions,
        "activeSessionsHistory": activeSessionsHistory, # This is now populated by the backend
        "alertLog": alertLog,
        "diskUsage": diskUsage,
        "topWaitEvents": topWaitEvents # This is now a snapshot for SE
    }


def send_data(data):
    """Sends data to the central server."""
    try:
        headers = {'Content-Type': 'application/json'}
        # Use a more compact representation for network transfer
        response = requests.post(SERVER_URL, data=json.dumps(data, indent=2), headers=headers)
        response.raise_for_status()
        print(f"[{datetime.now(timezone.utc).isoformat()}] Successfully sent data. Server responded with: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"[{datetime.now(timezone.utc).isoformat()}] Error sending data: {e}")

def main():
    """Main loop for the agent."""
    print(f"Starting agent for server '{DB_SERVER_ID}'...")
    print(f"Will send data to '{SERVER_URL}' every {FREQUENCY_SECONDS} seconds.")

    connection = get_db_connection()
    psutil = get_psutil()
    if not psutil:
        print("Could not import psutil. OS metrics will not be collected.")


    try:
        while True:
            # If DB is down, try to reconnect
            if not connection or not connection.is_healthy():
                print("Attempting to reconnect to the database...")
                if connection:
                    try:
                        connection.close()
                    except Exception as e:
                        print(f"Error closing stale connection: {e}")
                connection = get_db_connection()
            
            data = collect_real_data(connection, psutil)
            
            # If data collection suggests the DB is down, ensure we try to reconnect next time.
            if connection and not data.get("dbIsUp", True):
                 try:
                    connection.close()
                 except Exception as e:
                    print(f"Error closing connection that was reported as down: {e}")
                 connection = None # Force reconnect on next loop

            if data:
                send_data(data)
            time.sleep(FREQUENCY_SECONDS)
    finally:
        if connection:
            connection.close()
            print("--- DATABASE DISCONNECTED ---")


if __name__ == "__main__":
    main()

    