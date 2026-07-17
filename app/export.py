"""Export functionality for PDF and HTML generation."""

import os
import logging
from io import BytesIO
from typing import Tuple
from weasyprint import HTML
from flask import Blueprint, render_template, request, send_file, jsonify, Response
from .models import Proposal
from .utils import build_export_context
from .config import Config, ERROR_MESSAGES

logger = logging.getLogger(__name__)

export_bp = Blueprint("export", __name__)

EXPORT_DIR = Config.EXPORTS_DIR


def ensure_export_dir() -> None:
    """Ensure export directory exists."""
    os.makedirs(EXPORT_DIR, exist_ok=True)


@export_bp.route("/export/pdf/<proposal_id>")
def export_pdf(proposal_id: str) -> Tuple[Response, int] | Response:
    """Export proposal as PDF."""
    proposal = Proposal.load(proposal_id)
    if not proposal:
        logger.warning(f"Proposal not found for PDF export: {proposal_id}")
        return jsonify(ERROR_MESSAGES['PROPOSAL_NOT_FOUND']), 404

    ctx = build_export_context(proposal)
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
def export_html(proposal_id: str) -> Tuple[Response, int]:
    """Export proposal as HTML file."""
    proposal = Proposal.load(proposal_id)
    if not proposal:
        logger.warning(f"Proposal not found for HTML export: {proposal_id}")
        return jsonify(ERROR_MESSAGES['PROPOSAL_NOT_FOUND']), 404

    ctx = build_export_context(proposal)
    html_content = render_template("export_proposal.html", **ctx)

    ensure_export_dir()
    html_path = os.path.join(EXPORT_DIR, f"{proposal_id}.html")
    with open(html_path, "w") as f:
        f.write(html_content)

    return send_file(
        html_path,
        mimetype="text/html",
        as_attachment=True,
        download_name=f"{proposal.title or 'proposal'}.html",
    )

