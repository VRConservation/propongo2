import os
from io import BytesIO
from weasyprint import HTML
from flask import Blueprint, render_template, request, send_file, jsonify, Response
from .models import Proposal

export_bp = Blueprint("export", __name__)

EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "exports")


def ensure_export_dir():
    os.makedirs(EXPORT_DIR, exist_ok=True)


@export_bp.route("/export/pdf/<proposal_id>")
def export_pdf(proposal_id):
    proposal = Proposal.load(proposal_id)
    if not proposal:
        return jsonify({"error": "Proposal not found"}), 404

    html_content = render_template(
        "export_proposal.html",
        proposal=proposal,
        tasks=proposal.tasks,
        budget_items=proposal.budget_items,
        total_budget=proposal.total_budget,
    )

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

    html_content = render_template(
        "export_proposal.html",
        proposal=proposal,
        tasks=proposal.tasks,
        budget_items=proposal.budget_items,
        total_budget=proposal.total_budget,
    )

    return Response(
        html_content,
        mimetype="text/html",
        headers={
            "Content-Disposition": f"attachment; filename={proposal.title or 'proposal'}.html"
        },
    )


@export_bp.route("/preview/<proposal_id>")
def preview(proposal_id):
    proposal = Proposal.load(proposal_id)
    if not proposal:
        return jsonify({"error": "Proposal not found"}), 404

    return render_template(
        "export_proposal.html",
        proposal=proposal,
        tasks=proposal.tasks,
        budget_items=proposal.budget_items,
        total_budget=proposal.total_budget,
    )
