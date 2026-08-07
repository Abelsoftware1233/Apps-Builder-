#!/usr/bin/env python3
"""
Android App Pro Builder — Backend (Flask)
Server-side project generatie + GitHub repo import.

Start lokaal:
    pip install -r requirements.txt
    python3 app.py
"""

import io
import os
import re
import sys
import zipfile
import tempfile
from pathlib import Path

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import requests

# generate_project.py staat een map hoger dan backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from generate_project import generate_all_files, ProjectConfigError, validate_config

app = Flask(__name__)
CORS(app)  # front-end (index.html) draait op een ander origin/poort

MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB — ruim genoeg voor een icoon + config
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

GITHUB_API = "https://api.github.com"
GITHUB_REPO_RE = re.compile(
    r'^https?://github\.com/(?P<owner>[\w.-]+)/(?P<repo>[\w.-]+?)(?:\.git)?/?$'
)


@app.errorhandler(413)
def too_large(_e):
    return jsonify({"error": "Bestand of request is te groot (max 5 MB)."}), 413


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/generate", methods=["POST"])
def generate():
    """Genereert een Android projectstructuur en stuurt hem als ZIP terug."""
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Verwacht JSON body."}), 400

    config = {
        "app_name": data.get("app_name", ""),
        "app_id": data.get("app_id", ""),
        "lang": data.get("lang", "kotlin"),
        "arch": data.get("arch", "mvvm"),
        "min_sdk": data.get("min_sdk", 26),
        "target_sdk": data.get("target_sdk", 34),
        "features": data.get("features", ["internet"]),
    }

    try:
        validate_config(config)
    except ProjectConfigError as e:
        return jsonify({"error": str(e)}), 400

    app_name = config["app_name"].strip()
    app_id = config["app_id"].strip()
    min_sdk = int(config["min_sdk"])
    target_sdk = int(config["target_sdk"])
    lang = config["lang"]
    arch = config["arch"]
    features = config["features"]
    is_kotlin = lang == "kotlin"
    ext = "kt" if is_kotlin else "java"
    package_path = app_id.replace(".", "/")
    app_name_safe = app_name.replace(" ", "")
    folder_name = app_name.replace(" ", "-").lower()

    try:
        files = generate_all_files(
            app_name, app_id, package_path, min_sdk, target_sdk,
            is_kotlin, arch, ext, features, app_name_safe,
        )
    except Exception as e:
        # onverwachte generatiefout -> nette 500 i.p.v. stacktrace naar de client
        app.logger.exception("Project generatie mislukt")
        return jsonify({"error": f"Genereren mislukt: {e}"}), 500

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filepath, content in files.items():
            zf.writestr(f"{folder_name}/{filepath}", content)
    buf.seek(0)

    return send_file(
        buf,
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"{folder_name}.zip",
    )


@app.route("/api/github-import", methods=["POST"])
def github_import():
    """Haalt metadata op van een GitHub repo (publiek of privé met token)."""
    data = request.get_json(silent=True) or {}
    repo_url = (data.get("repo_url") or "").strip()
    token = (data.get("token") or "").strip()

    if not repo_url:
        return jsonify({"error": "repo_url is verplicht."}), 400

    match = GITHUB_REPO_RE.match(repo_url)
    if not match:
        return jsonify({"error": "Ongeldige GitHub repo URL. Verwacht formaat: https://github.com/eigenaar/repo"}), 400

    owner, repo = match.group("owner"), match.group("repo")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        resp = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=headers, timeout=10)
    except requests.RequestException as e:
        return jsonify({"error": f"Kon GitHub niet bereiken: {e}"}), 502

    if resp.status_code == 404:
        return jsonify({"error": "Repo niet gevonden (of privé zonder geldig token)."}), 404
    if resp.status_code == 401:
        return jsonify({"error": "Ongeldig GitHub token."}), 401
    if resp.status_code == 403:
        return jsonify({"error": "GitHub rate limit bereikt of toegang geweigerd."}), 403
    if not resp.ok:
        return jsonify({"error": f"GitHub API fout ({resp.status_code})."}), 502

    repo_data = resp.json()

    # Voorgestelde app naam/ID afleiden uit de repo, zodat stap 1 in de UI ingevuld kan worden
    suggested_name = repo_data.get("name", repo).replace("-", " ").replace("_", " ").title()
    clean_owner = re.sub(r'[^a-z0-9]', '', owner.lower()) or "example"
    clean_repo = re.sub(r'[^a-z0-9]', '', repo.lower()) or "app"
    suggested_id = f"com.{clean_owner}.{clean_repo}"

    return jsonify({
        "name": repo_data.get("name"),
        "full_name": repo_data.get("full_name"),
        "description": repo_data.get("description"),
        "default_branch": repo_data.get("default_branch"),
        "private": repo_data.get("private"),
        "language": repo_data.get("language"),
        "stargazers_count": repo_data.get("stargazers_count"),
        "html_url": repo_data.get("html_url"),
        "suggested_app_name": suggested_name,
        "suggested_app_id": suggested_id,
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
