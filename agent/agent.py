
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
DB_CONNECTION_STRING = f"{DB_USER}/{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_SERVICE_NAME}"


# --- Agent & Server Configuration ---
SERVER_URL = "https://9000-firebase-proactivedb-1761776452727.cluster-uodogxybdfdkiqhne5y6pr6j4w.cloudworkstations.dev/api/report"
DB_SERVER_ID = "db6"
DB_NAME="PROD_CRM" # Added for better alert identification
FREQUENCY_SECONDS = 30

# --- State for I/O counters ---
previous_io_counters = None
previous_io_timestamp = None
previous_net_io_counters = None
previous_net_io_timestamp = None


def get_db_connection():
    """
    Establishes and returns a database connection using Thin Mode.
    """
    try:
        import oracledb
        # The following line is commented out to ensure Thin Mode is used.
        # oracledb.init_oracle_client()

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

    db_is_up = False
    db_status = "UNKNOWN"
    if connection:
        try:
            connection.ping()
            db_is_up = True
            cursor_check = connection.cursor()
            try:
                cursor_check.execute("SELECT status FROM V$INSTANCE")
                status_result = cursor_check.fetchone()
                if status_result:
                    db_status = status_result[0]
            except Exception:
                db_status = "READ"
            finally:
                cursor_check.close()
        except Exception as e:
            print(f"Database connection check failed: {e}")
            db_is_up = False

    cursor = connection.cursor() if db_is_up else None

    os_info = None
    host_memory = {}
    if psutil:
        os_info = {
            "platform": platform.system(),
            "release": platform.release(),
            "hostname": platform.node()
        }
        mem = psutil.virtual_memory()
        host_memory = {
            "total": round(mem.total / (1024**3), 2),
            "used": round(mem.used / (1024**3), 2),
            "free": round(mem.free / (1024**3), 2),
            "percent": mem.percent
        }

    def execute_query(query, params=None):
        if not cursor: return []
        try:
            cursor.execute(query, params) if params else cursor.execute(query)
            return cursor.fetchall()
        except Exception as e:
            if "ORA-00942" in str(e):
                print(f"Query failed due to permissions: {e}")
                raise PermissionError("ORA-00942") from e
            else:
                print(f"Error executing query: {e}")
            return []

    kpis = { "cpuUsage": 0, "memoryUsage": 0, "activeSessions": 0, "memoryUsedGB": 0, "memoryTotalGB": 0 }
    if psutil:
        kpis["cpuUsage"] = psutil.cpu_percent(interval=1)
        kpis["memoryUsage"] = host_memory.get("percent", 0)
        kpis["memoryUsedGB"] = host_memory.get("used", 0)
        kpis["memoryTotalGB"] = host_memory.get("total", 0)

    if cursor and db_status == "OPEN":
        try:
            kpi_results = execute_query("SELECT count(*) FROM v$session WHERE status = 'ACTIVE' AND type = 'USER' AND username IS NOT NULL")
            if kpi_results:
               kpis["activeSessions"] = kpi_results[0][0]
        except PermissionError:
            print("Warning: Could not query v$session for KPIs.")

    # --- Top Processes ---
    top_cpu_processes = []
    top_memory_processes = []
    top_io_processes = []
    top_network_processes = [] # Placeholder

    if psutil:
        # Prime cpu_percent calls
        for p in psutil.process_iter():
            try: p.cpu_percent(interval=None) 
            except: pass
        time.sleep(0.1)

        all_procs = []
        attrs = ['pid', 'name', 'username', 'cpu_percent', 'memory_percent', 'io_counters']
        for p in psutil.process_iter(attrs):
            try:
                p_info = p.info
                # Create a clean, serializable dictionary from the start
                clean_proc = {
                    'pid': p_info.get('pid'),
                    'name': p_info.get('name'),
                    'username': p_info.get('username'),
                    'cpu_percent': p_info.get('cpu_percent'),
                    'memory_percent': p_info.get('memory_percent'),
                    'read_bytes': 0,
                    'write_bytes': 0
                }
                io = p_info.get('io_counters')
                if io:
                    clean_proc['read_bytes'] = io.read_bytes
                    clean_proc['write_bytes'] = io.write_bytes
                all_procs.append(clean_proc)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass

        # Sort the clean list for each category
        top_cpu_processes = sorted([p for p in all_procs if p.get('cpu_percent') is not None], key=lambda p: p['cpu_percent'], reverse=True)[:10]
        top_memory_processes = sorted([p for p in all_procs if p.get('memory_percent') is not None], key=lambda p: p['memory_percent'], reverse=True)[:10]
        top_io_processes = sorted(all_procs, key=lambda p: p['read_bytes'] + p['write_bytes'], reverse=True)[:10]

    # --- Single Process, Current Performance, and other metrics... ---
    single_process = {}
    current_performance = { "cpu": kpis["cpuUsage"], "memory": kpis["memoryUsage"], "io_read": 0, "io_write": 0, "network_up": 0, "network_down": 0, "active_sessions": kpis["activeSessions"] }
    tablespaces, backups, activeSessions, detailedActiveSessions, activeSessionsHistory, alertLog, diskUsage, topWaitEvents, standbyStatus = [], [], [], [], [], [], [], [], []

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
        "host_memory": host_memory,
        "kpis": kpis,
        "topCpuProcesses": top_cpu_processes,
        "topMemoryProcesses": top_memory_processes,
        "topIoProcesses": top_io_processes,
        "topNetworkProcesses": top_network_processes,
        "single_process": single_process,
        "current_performance": current_performance,
        "tablespaces": tablespaces,
        "backups": backups,
        "activeSessions": activeSessions,
        "detailedActiveSessions": detailedActiveSessions,
        "activeSessionsHistory": activeSessionsHistory,
        "alertLog": alertLog,
        "diskUsage": diskUsage,
        "topWaitEvents": topWaitEvents,
        "standbyStatus": standbyStatus
    }

def send_data(data):
    """Sends data to the central server."""
    try:
        headers = {'Content-Type': 'application/json'}
        # The data structure is now guaranteed to be serializable
        response = requests.post(SERVER_URL, data=json.dumps(data), headers=headers)
        response.raise_for_status()
        print(f"[{datetime.now(timezone.utc).isoformat()}] Successfully sent data. Status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"[{datetime.now(timezone.utc).isoformat()}] Error sending data: {e}")
    except Exception as e:
        print(f"An unexpected error occurred during send_data: {e}")

def main():
    """Main loop for the agent."""
    print(f"Starting agent for server '{DB_SERVER_ID}'...")
    print(f"Will send data to '{SERVER_URL}' every {FREQUENCY_SECONDS} seconds.")

    connection = None
    psutil_lib = get_psutil()
    if not psutil_lib:
        print("Could not import psutil. OS metrics will not be collected.")

    try:
        while True:
            # Reconnect logic
            if connection:
                try: connection.ping()
                except Exception:
                    print("Connection ping failed. Will attempt to reconnect.")
                    try: connection.close()
                    except Exception: pass
                    connection = None
            
            if not connection:
                connection = get_db_connection()

            data = collect_real_data(connection, psutil_lib)
            if data:
                send_data(data)
            
            if not data.get("dbIsUp", False) and connection:
                try: connection.close()
                finally: connection = None
            
            print(f"\n--- Waiting for {FREQUENCY_SECONDS} seconds ---\n")
            time.sleep(FREQUENCY_SECONDS)
    finally:
        if connection:
            connection.close()
            print("--- DATABASE DISCONNECTED ---")

if __name__ == "__main__":
    main()
