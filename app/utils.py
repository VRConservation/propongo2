"""Utility functions for Propongo2."""

from typing import Dict, Any


def build_export_context(proposal) -> Dict[str, Any]:
    """Build context dictionary for export and preview templates.
    
    Args:
        proposal: Proposal object
        
    Returns:
        dict: Context dictionary with all necessary template variables
    """
    indirect_percent = getattr(proposal, 'indirect_percent', 0) or 0
    indirect_amount = proposal.total_budget * (indirect_percent / 100)
    total_with_indirect = proposal.total_budget + indirect_amount

    tasks_with_timing = []
    for t in proposal.tasks:
        tasks_with_timing.append({
            "id": t.get("id", ""),
            "name": t.get("name", ""),
            "description": t.get("description", ""),
            "lead_entity": t.get("lead_entity", ""),
            "start_month": t.get("start_month"),
            "start_year": t.get("start_year"),
            "duration_months": t.get("duration_months", 1),
        })

    budget_with_timing = []
    timings = proposal.budget_item_timings or {}
    for item in proposal.budget_items:
        item_id = item.get("id", "")
        timing = timings.get(item_id, {})
        budget_with_timing.append({
            **item,
            "start_month": timing.get("start_month"),
            "start_year": timing.get("start_year"),
            "duration_months": timing.get("duration_months", 1),
            "task_id": item.get("task_id", ""),
        })

    return {
        "proposal": proposal,
        "tasks": tasks_with_timing,
        "budget_items": proposal.budget_items,
        "budget_with_timing": budget_with_timing,
        "total_budget": proposal.total_budget,
        "indirect_percent": indirect_percent,
        "indirect_amount": indirect_amount,
        "total_with_indirect": total_with_indirect,
    }
