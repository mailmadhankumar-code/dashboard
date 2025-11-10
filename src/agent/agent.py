
import requests
import json
import time
import platform
from datetime import datetime, timedelta, timezone
import re

# --- Database Connection Configuration ---
# TODO: Replace these placeholders with your actual database credentials.
DB_HOST = "localhost"
DB_PORT = 1521
DB_SERVICE_NAME = "testpdb"
DB_USER = "madhan"
DB_PASSWORD = "madhan123"
# Set to True to connect as SYSDBA (e.g., for a mounted database)
DB_CONNECT_AS_SYSDBA = False 


# This would typically be constructed from the variables above.
# Example for oracledb library: dsn = f"{DB_HOST}:{DB_PORT}/{DB_SERVICE_NAME}"
DB_CONNECTION_STRING = f"{DB_USER}/{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_SERVICE_NAME}"


# --- Agent & Server Configuration ---
SERVER_URL = "http://127.0.0.1:5173/api/report"
DB_SERVER_ID = "db1"
DB_NAME="PROD_CRM" # Added for better alert identification
FREQUENCY_SECONDS = 30

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
        import oracledb
        # The following line enables Thick mode. It requires Oracle Instant Client to be installed.
        # This is often necessary for older database versions (e.g., 11g).
        oracledb.init_oracle_client()
        
        connection_params = {
            "user": DB_USER,
            "password": DB_PASSWORD,
            "dsn": f"{DB_HOST}:{DB_PORT}/{DB_SERVICE_NAME}"
        }

        if DB_CONNECT_AS_SYSDBA:
            connection_params["mode"] = oracledb.SYSDBA
            print(f"Connecting to: {connection_params['dsn']} as SYSDBA")
        else:
            print(f"Connecting to: {DB_CONNECTION_STRING}")

        connection = oracledb.connect(**connection_params)

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
    db_status = "UNKNOWN"
    if connection:
        try:
            # A lightweight query to check if the connection is active
            cursor_check = connection.cursor()
            cursor_check.execute("SELECT 1 FROM DUAL")
            cursor_check.fetchone()
            db_is_up = True
            
            # Get DB status (OPEN, MOUNTED, etc.)
            try:
                cursor_check.execute("SELECT status FROM V$INSTANCE")
                status_result = cursor_check.fetchone()
                if status_result:
                    db_status = status_result[0]
            except Exception:
                db_status = "READ" # If instance view fails, assume at least readable

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
                # Re-raise with a specific type to be caught by the adaptive logic
                raise PermissionError("ORA-00942") from e
            else:
                print(f"Error executing query: {e}")
            return [] # Return an empty list on other errors to prevent crashes


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
    if cursor and db_status == "OPEN":
        try:
            kpi_query = """
            SELECT count(*) FROM v$session WHERE status = 'ACTIVE' AND type = 'USER' AND username IS NOT NULL
            """
            kpi_results = execute_query(kpi_query)
            if kpi_results:
               kpis["activeSessions"] = kpi_results[0][0]
        except PermissionError: # Catch if v$session is not available (highly unlikely but safe)
            print("Warning: Could not query v$session for active sessions count.")


    # --- Current Performance Metrics (for history) ---
    io_details = []
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
                current_partitions = psutil.disk_partitions()
                
                # --- Cross-platform I/O to Partition mapping ---
                for part in current_partitions:
                    if 'loop' in part.opts or not part.fstype:
                        continue
                    
                    io_counter_key = None
                    if platform.system() == "Windows":
                        try:
                            import wmi
                            c = wmi.WMI()
                            for disk in c.Win32_LogicalDiskToPartition():
                                if disk.Antecedent.DeviceID in str(disk.Dependent):
                                    for physical in c.Win32_DiskDrive():
                                        if physical.DeviceID.replace('\\', '').replace('.', '') in current_io_counters:
                                            io_counter_key = physical.DeviceID.replace('\\', '').replace('.', '')
                                            break
                                if io_counter_key: break
                        except Exception:
                            io_counter_key = list(current_io_counters.keys())[0] if current_io_counters else None
                    else: # Linux, Solaris, etc.
                        device_name = part.device.split('/')[-1]
                        if device_name in current_io_counters:
                            io_counter_key = device_name
                        else:
                            for key in current_io_counters.keys():
                                if key.endswith(device_name):
                                    io_counter_key = key
                                    break
                    
                    if io_counter_key and io_counter_key in previous_io_counters:
                        current_stats = current_io_counters[io_counter_key]
                        prev_stats = previous_io_counters[io_counter_key]
                        
                        read_bytes_diff = current_stats.read_bytes - prev_stats.read_bytes
                        write_bytes_diff = current_stats.write_bytes - prev_stats.write_bytes

                        if read_bytes_diff < 0: read_bytes_diff = 0
                        if write_bytes_diff < 0: write_bytes_diff = 0
                        
                        read_rate = read_bytes_diff / time_delta / (1024 * 1024) # MB/s
                        write_rate = write_bytes_diff / time_delta / (1024 * 1024) # MB/s

                        if read_rate > 0.001 or write_rate > 0.001:
                            io_details.append({
                                "device": part.device,
                                "mount_point": part.mountpoint,
                                "read_mb_s": round(read_rate, 2),
                                "write_mb_s": round(write_rate, 2)
                            })
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
    if cursor and db_status == "OPEN":
        try:
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
        except PermissionError:
            print("Warning: Could not query DBA views for tablespaces.")

    # --- Backups ---
    backups = []
    if cursor and db_status == "OPEN":
        try:
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
                        "input_bytes": row[4] if row[4] is not None else 0,
                        "output_bytes": row[5] if row[5] is not None else 0,
                        "elapsed_seconds": row[6] if row[6] is not None else 0,
                        "db_name": DB_NAME
                    })
        except PermissionError:
            print("Warning: V$RMAN_BACKUP_JOB_DETAILS not accessible.")


    # --- Active Sessions ---
    activeSessions = []
    if cursor and db_status == "OPEN":
        try:
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
        except PermissionError:
            print("Warning: v$session not accessible for active session list.")

    # --- Detailed Active Sessions ---
    detailedActiveSessions = []
    if cursor and db_status == "OPEN":
        try:
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
        except PermissionError:
             print("Warning: gv$session not accessible for detailed sessions.")


    # --- Active Sessions History is now collected from snapshots by the backend ---
    activeSessionsHistory = []


    # --- Alert Log ---
    alertLog = []
    if cursor:
        two_days_ago_utc = datetime.now(timezone.utc) - timedelta(days=2)
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
            alert_results = execute_query(alert_log_query_vdiag, params=[two_days_ago_utc])
        except PermissionError: # This will catch ORA-00942
            print("INFO: Query on V$DIAG_ALERT_EXT failed (likely permissions or version). Will attempt fallback.")
            alert_results = [] # Ensure results are empty before fallback
        except Exception as e:
            print(f"WARNING: Query on V$DIAG_ALERT_EXT failed with unexpected error: {e}")
            alert_results = [] # Ensure results are empty before fallback

        # Fallback for older Oracle versions or if V$DIAG_ALERT_EXT is not available/accessible
        if not alert_results:
            print("INFO: V$DIAG_ALERT_EXT failed or returned no results. Falling back to sys.x$dbgalertext.")
            try:
                alert_log_query_fallback = """
                    SELECT TO_CHAR(ORIGINATING_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS'), message_text
                    FROM sys.x$dbgalertext
                    WHERE (message_text LIKE 'ORA-%' OR message_text LIKE 'TNS-%')
                    AND ORIGINATING_TIMESTAMP > :1
                    ORDER BY ORIGINATING_TIMESTAMP DESC
                """
                alert_results = execute_query(alert_log_query_fallback, params=[two_days_ago_utc])
            except Exception as e:
                print(f"ERROR: Could not query alert log fallback (sys.x$dbgalertext may require specific grants): {e}")

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


    # --- Top Wait Events (Adaptive: ASH or v$session) ---
    topWaitEvents = []
    if cursor and db_status == "OPEN":
        ash_results = []
        use_ash_data = False
        try:
            # Query for the last 15 minutes of ASH data (Enterprise Edition with Diagnostics Pack)
            wait_events_ash_query = """
                WITH ash_data AS (
                    SELECT
                        event,
                        TRUNC(sample_time, 'MI') AS sample_minute,
                        session_id,
                        time_waited
                    FROM gv$active_session_history
                    WHERE sample_time > SYSTIMESTAMP - INTERVAL '15' MINUTE
                      AND event IS NOT NULL
                      AND wait_class <> 'Idle'
                )
                SELECT
                    event,
                    TO_CHAR(sample_minute, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as sample_time_str,
                    COUNT(DISTINCT session_id) AS session_count,
                    SUM(time_waited) / 1000000 AS total_latency_seconds
                FROM ash_data
                GROUP BY event, sample_minute
                ORDER BY sample_minute, session_count DESC
            """
            ash_results = execute_query(wait_events_ash_query)
            
            if ash_results: # If ASH query returned data, process it
                use_ash_data = True
                events_by_name = {}
                for row in ash_results:
                    event_name, sample_time, session_count, latency = row
                    if event_name not in events_by_name:
                        events_by_name[event_name] = { "event": event_name, "value": 0, "data": [] }
                    
                    events_by_name[event_name]["data"].append({
                        "date": sample_time,
                        "value": session_count,
                        "latency": round(latency, 4)
                    })
                    events_by_name[event_name]["value"] += session_count
                
                topWaitEvents = list(events_by_name.values())
                topWaitEvents.sort(key=lambda x: x['value'], reverse=True)

        except PermissionError: # Catches the ORA-00942 from execute_query
            print("GV$ACTIVE_SESSION_HISTORY not accessible. Will fall back to v$session snapshot.")
        except Exception as e:
            print(f"An unexpected error occurred while querying wait events: {e}")

        # Fallback logic: If ASH data wasn't used (due to error or no rows), use v$session
        if not use_ash_data:
            print("Using v$session for real-time wait event snapshot.")
            try:
                wait_events_snapshot_query = """
                    SELECT event, COUNT(*) as session_count
                    FROM v$session
                    WHERE wait_class <> 'Idle' AND type = 'USER' AND username IS NOT NULL
                    GROUP BY event
                    ORDER BY session_count DESC
                """
                snapshot_results = execute_query(wait_events_snapshot_query)

                if snapshot_results:
                    for row in snapshot_results:
                        topWaitEvents.append({
                            "event": row[0],
                            "value": row[1]
                        })
            except Exception as e:
                print(f"An unexpected error occurred while querying v$session for wait events: {e}")

    # --- Standby Status ---
    standbyStatus = []
    
    def parse_lag_to_hours_str(lag_str):
        """Parses Oracle lag string (+DD HH:MI:SS) into a formatted string."""
        if not lag_str or lag_str == '0':
            return "0.00"
        
        match = re.match(r'\+?(\d{2,})\s(\d{2}):(\d{2}):(\d{2})', lag_str) # For days, e.g., +00 02:30:00
        if not match:
             match = re.match(r'(\d{2}):(\d{2}):(\d{2})', lag_str) # For hours only, e.g., 02:30:00
             if match:
                 hours, minutes, seconds = [int(x) for x in match.groups()]
                 total_hours = hours + minutes / 60 + seconds / 3600
                 return f"{total_hours:.2f}"
             else: # If no match, it might be in an unexpected format, return 0
                 return "0.00"
        
        days, hours, minutes, seconds = [int(x) for x in match.groups()]
        total_hours = (days * 24) + hours + minutes / 60 + seconds / 3600
        return f"{total_hours:.2f}"


    if cursor and (db_status == "OPEN" or db_status == "MOUNTED"):
        lag_stats = {}
        mrp_stats = {}
        apply_rate_mb_s = 0.0

        # 1. Get Lag stats from V$DATAGUARD_STATS
        try:
            standby_query = """
                SELECT name, value FROM V$DATAGUARD_STATS
            """
            standby_results = execute_query(standby_query)
            for row in standby_results:
                lag_stats[row[0]] = row[1]
        except PermissionError:
            print("Warning: V$DATAGUARD_STATS not accessible. Lag times will not be reported.")
        except Exception as e:
            print(f"An unexpected error occurred while querying standby lag status: {e}")

        # 2. Get MRP status from V$MANAGED_STANDBY
        try:
            mrp_query = """
                SELECT PROCESS, STATUS, SEQUENCE# FROM V$MANAGED_STANDBY WHERE PROCESS = 'MRP0'
            """
            mrp_results = execute_query(mrp_query)
            if mrp_results:
                mrp_stats = {
                    "process": mrp_results[0][0],
                    "status": mrp_results[0][1],
                    "sequence": mrp_results[0][2]
                }
        except PermissionError:
            print("Warning: V$MANAGED_STANDBY not accessible. MRP status will not be reported.")
        except Exception as e:
            print(f"An unexpected error occurred while querying MRP status: {e}")

        # 3. Get Apply Rate from V$RECOVERY_PROGRESS
        try:
            apply_rate_query = """
                SELECT sofar FROM v$recovery_progress
                WHERE item = 'Active Apply Rate'
                AND start_time = (SELECT MAX(start_time) FROM v$recovery_progress)
            """
            apply_rate_results = execute_query(apply_rate_query)
            if apply_rate_results:
                # Value is in Kilobytes/sec, convert to Megabytes/sec
                apply_rate_mb_s = (apply_rate_results[0][0] or 0) / 1024.0
        except PermissionError:
            print("Warning: V$RECOVERY_PROGRESS not accessible. Apply rate will not be reported.")
        except Exception as e:
            print(f"An unexpected error occurred while querying apply rate: {e}")


        # Only build the final object if we have some data
        if lag_stats or mrp_stats:
            transport_lag_str = lag_stats.get('transport lag', '0')
            apply_lag_str = lag_stats.get('apply lag', '0')
            
            transport_lag_hours = parse_lag_to_hours_str(transport_lag_str)
            apply_lag_hours = parse_lag_to_hours_str(apply_lag_str)

            overall_status = "UNKNOWN"
            try:
                # Convert hours to float for comparison
                transport_lag_float = float(transport_lag_hours)
                apply_lag_float = float(apply_lag_hours)
                
                # A small threshold accounts for minor float inaccuracies or very brief lag.
                zero_threshold = 0.02 # ~1 minute
                five_min_threshold = 0.083 # 5 minutes in hours
                
                if apply_lag_float <= zero_threshold and transport_lag_float <= zero_threshold:
                    overall_status = "SYNCHRONIZED"
                elif transport_lag_float > five_min_threshold:
                    overall_status = "LAGGING"
                elif transport_lag_float > zero_threshold and transport_lag_float <= five_min_threshold:
                     overall_status = "NEAR SYNCHRONIZE"
                elif mrp_stats.get('status') == 'APPLYING_LOG':
                    overall_status = "APPLYING"
                else:
                    # Fallback if conditions are ambiguous
                    overall_status = mrp_stats.get('status', 'UNKNOWN').replace('_', ' ')

            except (ValueError, TypeError):
                overall_status = "UNKNOWN" # Handle if conversion fails


            standbyStatus.append({
                "name": "Standby",
                "status": overall_status,
                "transport_lag": transport_lag_hours,
                "apply_lag": apply_lag_hours,
                "mrp_status": mrp_stats.get("status", "N/A"),
                "sequence": mrp_stats.get("sequence", 0),
                "apply_rate_mb_s": round(apply_rate_mb_s, 2),
            })


    if cursor:
        cursor.close()

    # --- Assemble the final data structure ---
    return {
        "id": DB_SERVER_ID,
        "dbName": DB_NAME,
        "timestamp": now.isoformat(),
        "dbIsUp": db_is_up,
        "dbStatus": db_status,
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
        "topWaitEvents": topWaitEvents,
        "standbyStatus": standbyStatus
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

    

    

    

    

    