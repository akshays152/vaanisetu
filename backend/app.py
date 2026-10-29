from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import json
import sqlite3

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


DB_PATH = Path(__file__).with_name("vaanisetu.db")

AVAILABLE_SLOTS = [
    "10:00 AM",
    "10:30 AM",
    "11:00 AM",
    "11:30 AM",
    "2:00 PM",
    "2:30 PM",
]


def validate_appointment_date(value: str):
    try:
        requested_date = datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Date must use YYYY-MM-DD format",
        )

    if requested_date < datetime.now().date():
        raise HTTPException(status_code=400, detail="Date is in the past")

    if requested_date.weekday() == 6:
        raise HTTPException(
            status_code=400,
            detail="The clinic is closed on Sundays",
        )


def connect():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def initialize_db():
    with connect() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS appointments (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                patient_name TEXT NOT NULL,
                doctor TEXT,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                status TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        """)


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_db()
    yield


app = FastAPI(title="VaaniSetu API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AgentInput(BaseModel):
    name: str
    purpose: str
    language: str
    bilingual: bool = False
    instructions: str
    greeting: str
    voice: str = ""
    context: str = ""
    status: str = "Active"
    createdAt: str = "Just now"


class BookingInput(BaseModel):
    patientName: str
    date: str
    time: str
    doctor: str = "Dr. Mehta"
    sessionId: str | None = None


def row_to_agent(row):
    return json.loads(row["data"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "VaaniSetu API"}


@app.get("/agents")
def list_agents():
    with connect() as db:
        rows = db.execute("SELECT data FROM agents ORDER BY rowid").fetchall()
    return [json.loads(row["data"]) for row in rows]


@app.get("/agents/{agent_id}")
def get_agent(agent_id: str):
    with connect() as db:
        row = db.execute(
            "SELECT data FROM agents WHERE id = ?",
            (agent_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    return row_to_agent(row)


@app.post("/agents", status_code=201)
def create_agent(payload: AgentInput):
    agent = payload.model_dump()
    agent["id"] = str(uuid4())

    with connect() as db:
        db.execute(
            "INSERT INTO agents (id, data) VALUES (?, ?)",
            (agent["id"], json.dumps(agent)),
        )

    return agent


@app.put("/agents/{agent_id}")
def update_agent(agent_id: str, payload: AgentInput):
    with connect() as db:
        exists = db.execute(
            "SELECT id FROM agents WHERE id = ?",
            (agent_id,),
        ).fetchone()

        if exists is None:
            raise HTTPException(status_code=404, detail="Agent not found")

        agent = payload.model_dump()
        agent["id"] = agent_id

        db.execute(
            "UPDATE agents SET data = ? WHERE id = ?",
            (json.dumps(agent), agent_id),
        )

    return agent


@app.post("/agents/{agent_id}/sessions", status_code=201)
def start_session(agent_id: str):
    with connect() as db:
        exists = db.execute(
            "SELECT id FROM agents WHERE id = ?",
            (agent_id,),
        ).fetchone()

        if exists is None:
            raise HTTPException(status_code=404, detail="Agent not found")

        session_id = str(uuid4())
        db.execute(
            "INSERT INTO sessions (id, agent_id, created_at) VALUES (?, ?, ?)",
            (session_id, agent_id, datetime.now(timezone.utc).isoformat()),
        )

    return {"sessionId": session_id, "mode": "demo", "agentId": agent_id}


@app.get("/appointments/slots")
def get_available_slots(date: str):
    validate_appointment_date(date)

    with connect() as db:
        rows = db.execute(
            """SELECT time FROM appointments
               WHERE date = ? AND status = 'confirmed'""",
            (date,),
        ).fetchall()

    booked = {row["time"] for row in rows}

    return {
        "date": date,
        "availableSlots": [
            slot for slot in AVAILABLE_SLOTS if slot not in booked
        ],
    }


@app.post("/appointments", status_code=201)
def book_appointment(payload: BookingInput):
    validate_appointment_date(payload.date)

    if payload.time not in AVAILABLE_SLOTS:
        raise HTTPException(
            status_code=400,
            detail="That time is not an available clinic slot",
        )

    appointment = payload.model_dump()
    appointment.update({
        "id": str(uuid4()),
        "status": "confirmed",
        "message": "Appointment booked and saved.",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    with connect() as db:
        db.execute("BEGIN IMMEDIATE")

        existing = db.execute(
            """SELECT id FROM appointments
               WHERE date = ? AND time = ? AND status = 'confirmed'""",
            (payload.date, payload.time),
        ).fetchone()

        if existing:
            raise HTTPException(
                status_code=409,
                detail="That appointment slot is already booked",
            )

        db.execute(
            """INSERT INTO appointments
               (id, session_id, patient_name, doctor, date, time,
                status, message, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                appointment["id"],
                appointment["sessionId"],
                appointment["patientName"],
                appointment["doctor"],
                appointment["date"],
                appointment["time"],
                appointment["status"],
                appointment["message"],
                appointment["createdAt"],
            ),
        )

    return appointment


@app.get("/appointments/latest")
def latest_appointment():
    with connect() as db:
        row = db.execute(
            "SELECT * FROM appointments ORDER BY created_at DESC LIMIT 1"
        ).fetchone()

    if row is None:
        return {
            "status": "pending",
            "message": "No appointment has been booked yet.",
        }

    return {
        "status": row["status"],
        "patientName": row["patient_name"],
        "date": row["date"],
        "time": row["time"],
        "message": row["message"],
    }
