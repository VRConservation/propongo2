import json
import os
from flask import Blueprint, render_template, request, jsonify

snippets_bp = Blueprint("snippets", __name__)

SNIPPETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "snippets")
CUSTOM_DIR = os.path.join(SNIPPETS_DIR, "custom")


def ensure_dirs():
    os.makedirs(SNIPPETS_DIR, exist_ok=True)
    os.makedirs(CUSTOM_DIR, exist_ok=True)


def load_snippets(filename):
    filepath = os.path.join(SNIPPETS_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            return json.load(f)
    return []


def save_snippets(filename, data):
    ensure_dirs()
    filepath = os.path.join(SNIPPETS_DIR, filename)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)


def load_custom_snippets():
    ensure_dirs()
    snippets = []
    for filename in sorted(os.listdir(CUSTOM_DIR)):
        if filename.endswith(".json"):
            with open(os.path.join(CUSTOM_DIR, filename), "r") as f:
                snippets.append(json.load(f))
    return snippets


@snippets_bp.route("/snippets")
def get_all_snippets():
    return jsonify({
        "organization": load_snippets("organization.json"),
        "deliverables": load_snippets("deliverables.json"),
        "custom": load_custom_snippets(),
    })


@snippets_bp.route("/snippets/<category>", methods=["POST"])
def add_snippet(category):
    data = request.get_json()
    if not data or "title" not in data or "content" not in data:
        return jsonify({"error": "title and content required"}), 400

    snippet = {
        "id": data.get("id", __import__("uuid").uuid4().hex[:8]),
        "title": data["title"],
        "content": data["content"],
        "category": category,
    }

    if category == "custom":
        ensure_dirs()
        filepath = os.path.join(CUSTOM_DIR, f"{snippet['id']}.json")
        with open(filepath, "w") as f:
            json.dump(snippet, f, indent=2)
    elif category in ("organization", "deliverables"):
        snippets = load_snippets(f"{category}.json")
        snippets.append(snippet)
        save_snippets(f"{category}.json", snippets)
    else:
        return jsonify({"error": "Invalid category"}), 400

    return jsonify(snippet), 201


@snippets_bp.route("/snippets/<category>/<snippet_id>", methods=["DELETE"])
def delete_snippet(category, snippet_id):
    if category == "custom":
        filepath = os.path.join(CUSTOM_DIR, f"{snippet_id}.json")
        if os.path.exists(filepath):
            os.remove(filepath)
            return jsonify({"ok": True})
    elif category in ("organization", "deliverables"):
        snippets = load_snippets(f"{category}.json")
        snippets = [s for s in snippets if s.get("id") != snippet_id]
        save_snippets(f"{category}.json", snippets)
        return jsonify({"ok": True})

    return jsonify({"error": "Not found"}), 404
