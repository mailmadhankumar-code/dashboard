
import os
import json
import psutil
import oracledb
import requests
import platform
import time

# --- Oracle Thick Client Initialization ---
# The DPY-3010 error indicates the python-oracledb Thin mode is not compatible
# with your database version. Enabling Thick mode by calling init_oracle_client()
# is the solution.
#
# **PREREQUISITE:** You MUST install the Oracle Instant Client libraries on the
# machine running this agent. Download it from Oracle's website and ensure it's
# in your system's PATH or configure the 'lib_dir' parameter below.
# e.g., oracledb.init_oracle_client(lib_dir="/opt/oracle/instantclient_21_13")
try:
    oracledb.init_oracle_client()
except oracledb.Error as e:
    print("Error initializing Oracle Client. Make sure Oracle Instant Client is installed and configured correctly.")
    print(f"Oracle Error: {e}")
    # Exit if the client can't be initialized, as DB connections will fail.
    exit(1)


# --- Configuration ---

# Replace with your actual dashboard server endpoint
DASHBOARD_SERVER_URL = 'https://localhost/api/metrics'
# Replace with a secret key to authenticate the agent with your server
AGENT_API_KEY = 'your-secret-api-key'

# Oracle DB Connection Details (REPLACE WITH YOURS)
# For production, use a secure method like wallets or environment variables
DB_USER = "madhan"
DB_PASSWORD = "madhan123"
# Example DSN: "your_host:1521/your_service_name"
DB_DSN = "localhost:1521/testpdb"

# Agent Configuration
DB_ID = "prod_fin" # Unique identifier for this database instance
FETCH_INTERVAL_SECONDS = 60

# --- Helper Functions ---

def get_connection():
    """Establishes and returns a connection to the Oracle database."""
    try:
        connection = oracledb.connect(user=DB_USER, password=DB_PASSWORD, dsn=DB_DSN)
        return connection
    except oracledb.Error as e:
        print(f"Error connecting to Oracle Database: {e}")
        return None

def execute_query(connection, query):
    """Executes a SQL query and returns the results."""
    if not connection:
        return []
    cursor = connection.cursor()
    try:
        cursor.execute(query)
        # Fetch column names from the cursor description
        colnames = [desc[0].lower() for desc in cursor.description]
        # Create a list of dictionaries
        return [dict(zip(colnames, row)) for row in cursor.fetchall()]
    except oracledb.Error as e:
        print(f"Error executing query: {query}\n{e}")
        return []
    finally:
        cursor.close()

# --- Metric Collection Functions ---

def get_os_metrics():
    """Collects basic operating system metrics."""
    disk_usage = []
    # Gracefully handle "device is not ready" errors on Windows
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disk_usage.append({
                "mount": part.mountpoint,
                "totalGb": round(usage.total / (1024**3), 2),
                "usedGb": round(usage.used / (1024**3), 2),
            })
        except PermissionError:
            continue
        except OSError as e:
            if e.winerror == 21: # Catch "The device is not ready" error
                continue
            raise
    
    return {
        "os": platform.system(),
        "platformName": platform.platform(),
        "cpuUsage": psutil.cpu_percent(interval=1),
        "totalCpuCores": psutil.cpu_count(logical=True),
        "memoryUsage": psutil.virtual_memory().percent,
        "totalMemoryGb": round(psutil.virtual_memory().total / (1024**3), 2),
        "diskUsage": disk_usage,
        # History is collected server-side or by another process, agent sends current snapshot
        "cpuHistory": [], 
        "memoryHistory": [],
        "ioHistory": [],
        "networkHistory": [],
    }

def get_db_metrics(connection):
    """Collects core database metrics."""
    if not connection:
        return {
            "isUp": False,
            "version": "N/A",
            "uptime": "N/A",
            "activeSessions": 0,
            "dbType": "Primary", # Default, might need adjustment
        }

    version_query = "SELECT banner FROM v$version WHERE banner LIKE 'Oracle%'"
    uptime_query = "SELECT TO_CHAR(startup_time, 'YYYY-MM-DD HH24:MI:SS') as startup_time FROM v$instance"
    sessions_query = "SELECT COUNT(*) as session_count FROM v$session WHERE status = 'ACTIVE' AND type = 'USER'"
    db_role_query = "SELECT database_role FROM v$database"

    version_result = execute_query(connection, version_query)
    uptime_result = execute_query(connection, uptime_query)
    sessions_result = execute_query(connection, sessions_query)
    role_result = execute_query(connection, db_role_query)
    
    uptime_str = "N/A"
    if uptime_result:
        # This is a simplified uptime calculation
        uptime_str = f"Up since {uptime_result[0]['startup_time']}"

    return {
        "isUp": True,
        "version": version_result[0]['banner'] if version_result else "N/A",
        "uptime": uptime_str,
        "activeSessions": sessions_result[0]['session_count'] if sessions_result else 0,
        "dbType": role_result[0]['database_role'].replace(' ', '_').title() if role_result else "Primary",
    }
    
def get_detailed_sessions(connection):
    """Collects detailed information about active, non-idle sessions."""
    # This query is complex and may require DBA privileges. Using GV$ for RAC compatibility.
    # For non-RAC, replace GV$ with V$.
    query = """
    SELECT
        s.inst_id as inst,
        s.sid as sid,
        s.username as username,
        s.sql_id as sqlId,
        s.status as status,
        s.event as event,
        s.last_call_et as et,
        s.row_wait_obj# as obj,
        s.blocking_session as bs,
        s.blocking_instance as bi,
        s.module as module,
        s.machine as machine
    FROM
        gv$session s
    WHERE
        s.status = 'ACTIVE'
        AND s.wait_class != 'Idle'
        AND s.username IS NOT NULL
    ORDER BY
        s.event, s.last_call_et DESC
    """
    return execute_query(connection, query)


def get_tablespace_usage(connection):
    """Collects tablespace usage information."""
    query = """
    SELECT
        fs.tablespace_name as name,
        (df.bytes - fs.bytes) / 1024 / 1024 AS usedMb,
        df.bytes / 1024 / 1024 AS totalMb,
        df.maxbytes / 1024 / 1024 AS maxMb
    FROM
        (SELECT tablespace_name, SUM(bytes) AS bytes FROM dba_free_space GROUP BY tablespace_name) fs,
        (SELECT tablespace_name, SUM(bytes) AS bytes, SUM(GREATEST(bytes, maxbytes)) AS maxbytes FROM dba_data_files GROUP BY tablespace_name) df
    WHERE
        fs.tablespace_name = df.tablespace_name
    """
    return execute_query(connection, query)

# --- Main Agent Logic ---

def collect_and_send_data():
    """Main function to collect all metrics and send them to the dashboard server."""
    
    print("Collecting metrics...")

    os_up = True
    os_metrics = {}
    try:
        # A simple check to see if we can gather OS metrics
        os_metrics = get_os_metrics()
    except Exception as e:
        print(f"Could not collect OS metrics: {e}")
        os_up = False
        

    connection = get_connection()
    db_metrics = get_db_metrics(connection)

    payload = {
        "id": DB_ID,
        "timestamp": time.time(),
        "osUp": os_up,
        "isUp": db_metrics.get("isUp", False),
        **os_metrics,
        **db_metrics,
        "activeSessionsDetails": get_detailed_sessions(connection) if db_metrics.get("isUp") else [],
        "tablespaces": get_tablespace_usage(connection) if db_metrics.get("isUp") else [],
        # Other metrics like RMAN, Alert Log, Performance can be added here
        # For simplicity, they are mocked in the frontend for this example
        "rmanBackups": [],
        "alertLog": [],
        "performanceMetrics": { "waitEventsHistory": [], "activeSessionsHistory": [] },
    }
    
    if connection:
        connection.close()

    print(f"Sending data for {DB_ID} to {DASHBOARD_SERVER_URL}...")
    
    headers = {
        'Content-Type': 'application/json',
        'X-Agent-API-Key': AGENT_API_KEY
    }

    try:
        # Increased timeout to 30 seconds
        response = requests.post(DASHBOARD_SERVER_URL, data=json.dumps(payload), headers=headers, timeout=30)
        if response.status_code == 200:
            print("Data sent successfully.")
        else:
            print(f"Failed to send data. Status code: {response.status_code}, Response: {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"Error sending data to dashboard server: {e}")


if __name__ == "__main__":
    print("Starting ProactiveDB Agent...")
    while True:
        collect_and_send_data()
        print(f"Waiting for {FETCH_INTERVAL_SECONDS} seconds before next collection...")
        time.sleep(FETCH_INTERVAL_SECONDS)

    