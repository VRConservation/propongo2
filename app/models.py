import json
import os
from dataclasses import dataclass, field, asdict
from typing import Any
from datetime import datetime
import uuid


PROPOSALS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "proposals")


def ensure_dirs():
    os.makedirs(PROPOSALS_DIR, exist_ok=True)


@dataclass
class Task:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    budget_items: list = field(default_factory=list)
    lead_months: int = 0
    duration_months: int = 1


@dataclass
class BudgetItem:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str = ""
    name: str = ""
    cost_per_unit: float = 0.0
    units: float = 1.0

    @property
    def total_cost(self) -> float:
        return self.cost_per_unit * self.units


@dataclass
class Proposal:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    title: str = "Untitled Proposal"
    client_name: str = ""
    subtitle: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    project_summary: str = ""
    tasks: list = field(default_factory=list)
    qualifications: str = ""

    budget_items: list = field(default_factory=list)
    budget_item_timings: dict = field(default_factory=dict)
    start_date: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))
    indirect_percent: float = 0.0
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
    def load(cls, proposal_id: str) -> "Proposal | None":
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
