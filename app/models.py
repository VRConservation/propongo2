"""Data models for Propongo2.

Tasks and budget items are stored as dictionaries with the following structure:

Task dict:
    {
        'id': str,                # UUID
        'name': str,              # Task name
        'description': str,       # Task description
        'lead_entity': str,       # Organization responsible
        'start_month': int,       # Start month (1-12)
        'start_year': int,        # Start year
        'duration_months': int,   # Duration in months
    }

BudgetItem dict:
    {
        'id': str,                # UUID
        'task_id': str,           # Associated task UUID
        'name': str,              # Item name
        'cost_per_unit': float,   # Unit cost
        'units': float,           # Number of units
    }

Custom Section dict:
    {
        'id': str,                # UUID
        'title': str,             # Section title
        'content': str,           # Markdown content
        'order': int,             # Display order
    }
"""

import json
import os
from dataclasses import dataclass, field, asdict
from typing import Optional
from datetime import datetime
import uuid


PROPOSALS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "proposals")


def ensure_dirs() -> None:
    """Ensure data directories exist."""
    os.makedirs(PROPOSALS_DIR, exist_ok=True)


@dataclass
class Proposal:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    title: str = "Untitled Proposal"
    client_name: str = ""
    subtitle: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    project_summary: str = ""
    scope: str = ""
    tasks: list = field(default_factory=list)
    qualifications: str = ""

    budget_items: list = field(default_factory=list)
    budget_item_timings: dict = field(default_factory=dict)
    start_date: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))
    end_date: str = ""
    indirect_percent: float = 0.0
    show_budget_description: bool = False
    budget_description: str = ""
    timeline_use_days: bool = False
    timeline_show_budget: bool = False
    custom_sections: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "Proposal":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

    def save(self):
        ensure_dirs()
        self.updated_at = datetime.now().isoformat()
        filepath = os.path.join(PROPOSALS_DIR, f"{self.id}.json")
        tmp = filepath + ".tmp"
        with open(tmp, "w") as f:
            json.dump(self.to_dict(), f, indent=2)
            f.write("\n")
        os.replace(tmp, filepath)

    @classmethod
    def load(cls, proposal_id: str) -> Optional["Proposal"]:
        filepath = os.path.join(PROPOSALS_DIR, f"{proposal_id}.json")
        if not os.path.exists(filepath):
            return None
        try:
            with open(filepath, "r") as f:
                return cls.from_dict(json.load(f))
        except (json.JSONDecodeError, OSError):
            return None

    @classmethod
    def list_all(cls) -> list:
        ensure_dirs()
        proposals = []
        for filename in sorted(os.listdir(PROPOSALS_DIR)):
            if filename.endswith(".json"):
                try:
                    with open(os.path.join(PROPOSALS_DIR, filename), "r") as f:
                        data = json.load(f)
                        proposals.append({
                            "id": data.get("id", filename.replace(".json", "")),
                            "title": data.get("title", "Untitled"),
                            "client_name": data.get("client_name", ""),
                            "updated_at": data.get("updated_at", ""),
                        })
                except (json.JSONDecodeError, OSError):
                    continue
        return sorted(proposals, key=lambda x: x["updated_at"], reverse=True)

    @classmethod
    def delete(cls, proposal_id: str) -> bool:
        filepath = os.path.join(PROPOSALS_DIR, f"{proposal_id}.json")
        if os.path.exists(filepath):
            os.remove(filepath)
            return True
        return False

    @property
    def total_budget(self) -> float:
        return sum(
            item.get("cost_per_unit", 0) * item.get("units", 0)
            for item in self.budget_items
        )
