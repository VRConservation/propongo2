import os
from io import BytesIO
from weasyprint import HTML
from flask import Blueprint, render_template, request, send_file, jsonify, Response
from .models import Proposal

export_bp = Blueprint("export", __name__)

EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "exports")


def ensure_export_dir():
    os.makedirs(EXPORT_DIR, exist_ok=True)


def _build_export_context(proposal):
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


@export_bp.route("/export/pdf/<proposal_id>")
def export_pdf(proposal_id):
    proposal = Proposal.load(proposal_id)
    if not proposal:
        return jsonify({"error": "Proposal not found"}), 404

    ctx = _build_export_context(proposal)
    html_content = render_template("export_proposal.html", **ctx)

    ensure_export_dir()
    pdf_path = os.path.join(EXPORT_DIR, f"{proposal_id}.pdf")
    HTML(string=html_content, base_url=request.host_url).write_pdf(pdf_path)

    return send_file(
        pdf_path,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{proposal.title or 'proposal'}.pdf",
    )


@export_bp.route("/export/html/<proposal_id>")
def export_html(proposal_id):
    proposal = Proposal.load(proposal_id)
    if not proposal:
        return jsonify({"error": "Proposal not found"}), 404

    ctx = _build_export_context(proposal)
    html_content = render_template("export_proposal.html", **ctx)

    return Response(
        html_content,
        mimetype="text/html",
        headers={
            "Content-Disposition": f"inline; filename={proposal.title or 'proposal'}.html"
        },
    )

