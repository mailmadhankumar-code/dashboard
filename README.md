# ProactiveDB Insights

This is a centralized dashboard for monitoring Oracle databases, built with Next.js and a Python data collection agent.

## Architecture

The project consists of two main components:

1.  **Next.js Application (Dashboard & API):** A web-based dashboard for visualizing database performance metrics. It also includes the backend API that receives data from the agent, stores it, and serves it to the frontend.
2.  **Python Agent (`agent/agent.py`):** A standalone script that connects to an Oracle database, collects performance metrics from the database and the underlying OS, and sends them to the Next.js API.

## Getting Started

Follow these steps to set up and run the project. You will need two separate terminal windows: one for the Next.js application and one for the Python agent.

### 1. Configure the Environment

First, create a local environment file to store your email alert settings.

1.  **Copy the template:**
    ```bash
    cp .env .env.local
    ```
2.  **Edit `.env.local`:**
    Open the newly created `.env.local` file and fill in your SMTP server details. This is required for the application to send email alerts. If you leave these blank, alerts will only be printed to the console.

### 2. Run the Next.js Dashboard & API

This part runs the web interface and the backend API endpoints.

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will now be running at `http://localhost:5173`. You can open this URL in your web browser.

### 3. Configure and Run the Python Agent

This script collects and sends the data to your dashboard.

1.  **Navigate to the agent directory:**
    ```bash
    cd agent
    ```
2.  **Set up a Python virtual environment (recommended):**
    ```bash
    python3 -m venv venv
    source venv/bin/activate 
    # On Windows, use `venv\Scripts\activate`
    ```
3.  **Install Python dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Configure Agent Settings:**
    Open `agent/agent.py` and modify the "Database Connection Configuration" section at the top of the file with your Oracle database credentials.

    ```python
    # agent/agent.py

    # --- Database Connection Configuration ---
    DB_HOST = "your_db_host"
    DB_PORT = 1521
    DB_SERVICE_NAME = "your_service_name"
    DB_USER = "your_db_user"
    DB_PASSWORD = "your_db_password"
    ```
5.  **Run the agent:**
    ```bash
    python3 agent.py
    ```

The agent will now start collecting data from your Oracle database every 10 seconds and sending it to the dashboard. You should see the data appear on the web interface at `http://localhost:5173`.
