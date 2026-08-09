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
import shutil
import zipfile
import tempfile
import subprocess
import threading
import uuid
from pathlib import Path

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import requests

# generate_project.py staat een map hoger dan backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from generate_project import (
    generate_all_files, ProjectConfigError, validate_config,
    safe_resource_name, safe_folder_name,
)
from webview_generator import generate_webview_project, validate_webview_config

app = Flask(__name__)
CORS(app)  # front-end (index.html) draait op een ander origin/poort

MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB — ruim genoeg voor een icoon + config
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

# ===== WEB2APP APK BUILDER =====
# Een echte Gradle-build kan enkele minuten duren (zeker de eerste keer,
# als dependencies nog niet gecached zijn). Daarom bouwen we asynchroon:
# /api/build-apk start de build en geeft direct een job_id terug, de
# front-end pollt /api/build-apk/<job_id>/status tot 'done' of 'error'.

BUILD_JOBS_DIR = Path(tempfile.gettempdir()) / "web2app_builds"
BUILD_JOBS_DIR.mkdir(exist_ok=True)
BUILD_TIMEOUT_SECONDS = 15 * 60  # 15 minuten harde limiet per build
GRADLE_WRAPPER_SOURCE = Path(__file__).resolve().parent / "gradle_wrapper_template"

# In-memory job-status. Voor een enkele-server-instance setup is dit prima;
# bij meerdere workers/processen zou dit in Redis of een database moeten staan.
_build_jobs = {}
_build_jobs_lock = threading.Lock()


def _set_job(job_id, **kwargs):
    with _build_jobs_lock:
        _build_jobs.setdefault(job_id, {}).update(kwargs)


def _get_job(job_id):
    with _build_jobs_lock:
        return dict(_build_jobs.get(job_id, {}))


def _run_gradle_build(job_id: str, project_dir: Path, apk_output_path: Path):
    """Draait in een aparte thread: voert 'gradlew assembleDebug' uit en
    zet de job-status bij op basis van het resultaat."""
    try:
        _set_job(job_id, status="building", log="Gradle build gestart...")

        gradlew = project_dir / ("gradlew.bat" if os.name == "nt" else "gradlew")
        if not gradlew.exists():
            _set_job(job_id, status="error",
                      error="gradlew ontbreekt in het project — controleer GRADLE_WRAPPER_SOURCE op de server.")
            return
        if os.name != "nt":
            gradlew.chmod(0o755)

        env = os.environ.copy()
        # ANDROID_HOME / ANDROID_SDK_ROOT moet al op de server geconfigureerd zijn.
        if "ANDROID_HOME" not in env and "ANDROID_SDK_ROOT" not in env:
            _set_job(job_id, status="error",
                      error="ANDROID_HOME/ANDROID_SDK_ROOT is niet ingesteld op de server. "
                            "Installeer de Android SDK en zet de omgevingsvariabele.")
            return

        proc = subprocess.run(
            [str(gradlew), "assembleDebug", "--no-daemon", "--console=plain"],
            cwd=str(project_dir),
            env=env,
            capture_output=True,
            text=True,
            timeout=BUILD_TIMEOUT_SECONDS,
        )

        log_tail = (proc.stdout[-4000:] if proc.stdout else "") + "\n" + (proc.stderr[-4000:] if proc.stderr else "")

        if proc.returncode != 0:
            _set_job(job_id, status="error", error="Gradle build mislukt.", log=log_tail)
            return

        built_apk = project_dir / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
        if not built_apk.exists():
            _set_job(job_id, status="error",
                      error="Build meldde succes, maar de APK is niet gevonden op de verwachte locatie.",
                      log=log_tail)
            return

        apk_output_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(built_apk, apk_output_path)
        _set_job(job_id, status="done", log=log_tail, apk_path=str(apk_output_path))

    except subprocess.TimeoutExpired:
        _set_job(job_id, status="error", error=f"Build duurde langer dan {BUILD_TIMEOUT_SECONDS // 60} minuten en is afgebroken.")
    except Exception as e:
        app.logger.exception("Onverwachte fout tijdens APK build")
        _set_job(job_id, status="error", error=f"Onverwachte serverfout: {e}")
    finally:
        # Projectbronnen opruimen, de gebouwde APK zelf blijft staan (apk_output_path)
        try:
            shutil.rmtree(project_dir, ignore_errors=True)
        except Exception:
            pass

GITHUB_API = "https://api.github.com"
GITHUB_REPO_RE = re.compile(
    r'^https?://github\.com/(?P<owner>[\w.-]+)/(?P<repo>[\w.-]+?)(?:\.git)?/?$'
)
# GitHub Pages URL, bv. https://gebruiker.github.io/repo-naam/ (of zonder repo-pad
# voor een user/organisatie-pagina "gebruiker.github.io" -> repo heet dan "gebruiker.github.io")
GITHUB_PAGES_RE = re.compile(
    r'^https?://(?P<owner>[\w-]+)\.github\.io(?:/(?P<repo>[\w.-]+?))?/?(?:[?#].*)?$'
)


def normalize_repo_url(url: str) -> str:
    """Zet een GitHub Pages URL om naar de bijbehorende repo-URL op github.com.
    Reguliere github.com-URLs komen ongewijzigd terug."""
    url = url.strip()
    if GITHUB_REPO_RE.match(url):
        return url

    pages_match = GITHUB_PAGES_RE.match(url)
    if pages_match:
        owner = pages_match.group("owner")
        repo = pages_match.group("repo")
        # Geen sub-pad -> user/org Pages site, repo heet dan "<owner>.github.io"
        if not repo:
            repo = f"{owner}.github.io"
        return f"https://github.com/{owner}/{repo}"

    return url


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
    app_name_safe = safe_resource_name(app_name)
    folder_name = safe_folder_name(app_name)

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
            arcname = f"{folder_name}/{filepath}"
            # Defensieve Zip Slip check: alle entries moeten binnen de projectmap blijven.
            normalized = os.path.normpath(arcname)
            if normalized.startswith("..") or os.path.isabs(normalized):
                app.logger.error("Zip Slip poging geblokkeerd: %r", arcname)
                return jsonify({"error": "Ongeldig bestandspad in project generatie."}), 500
            zf.writestr(arcname, content)
    buf.seek(0)

    return send_file(
        buf,
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"{folder_name}.zip",
    )


def _write_files_to_disk(files: dict, project_dir: Path):
    """Schrijft een {relatief_pad: inhoud} dict veilig naar disk.
    Blokkeert Zip Slip-achtige paden (../) net als bij de ZIP-generatie.
    Inhoud mag str (tekstbestanden) of bytes (bv. gegenereerde PNG-iconen) zijn."""
    project_dir.mkdir(parents=True, exist_ok=True)
    resolved_root = project_dir.resolve()
    for rel_path, content in files.items():
        target = (project_dir / rel_path).resolve()
        if resolved_root not in target.parents:
            raise ProjectConfigError(f"Ongeldig bestandspad geweigerd: {rel_path}")
        target.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, bytes):
            target.write_bytes(content)
        else:
            target.write_text(content, encoding="utf-8")


def _copy_gradle_wrapper(project_dir: Path):
    """Kopieert gradlew, gradlew.bat en gradle/wrapper/* uit het sjabloon
    (zie backend/gradle_wrapper_template/) naar het gegenereerde project.
    Zonder deze bestanden kan een Gradle-build niet starten."""
    if not GRADLE_WRAPPER_SOURCE.exists():
        raise RuntimeError(
            f"Gradle wrapper sjabloon ontbreekt op {GRADLE_WRAPPER_SOURCE}. "
            "Zie backend/README-webview-setup.md voor installatie-instructies."
        )
    for item in GRADLE_WRAPPER_SOURCE.rglob("*"):
        rel = item.relative_to(GRADLE_WRAPPER_SOURCE)
        target = project_dir / rel
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)


@app.route("/api/generate-webview", methods=["POST"])
def generate_webview():
    """Genereert een Web2App WebView-project en stuurt de broncode als ZIP terug
    (géén gebouwde APK — voor wie zelf in Android Studio wil bouwen of geen
    Android SDK op de server heeft geconfigureerd)."""
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Verwacht JSON body."}), 400

    config = {
        "app_name": data.get("app_name", ""),
        "app_id": data.get("app_id", ""),
        "url": data.get("url", ""),
        "min_sdk": data.get("min_sdk", 21),
        "target_sdk": data.get("target_sdk", 34),
    }
    try:
        validate_webview_config(config)
    except ProjectConfigError as e:
        return jsonify({"error": str(e)}), 400

    app_name = config["app_name"].strip()
    app_id = config["app_id"].strip()
    url = config["url"].strip()
    folder_name = safe_folder_name(app_name)

    try:
        files = generate_webview_project(
            app_name, app_id, url,
            min_sdk=int(config["min_sdk"]), target_sdk=int(config["target_sdk"]),
            show_progress_bar=bool(data.get("show_progress_bar", True)),
            allow_zoom=bool(data.get("allow_zoom", False)),
        )
    except Exception as e:
        app.logger.exception("Web2App generatie mislukt")
        return jsonify({"error": f"Genereren mislukt: {e}"}), 500

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filepath, content in files.items():
            arcname = f"{folder_name}/{filepath}"
            normalized = os.path.normpath(arcname)
            if normalized.startswith("..") or os.path.isabs(normalized):
                return jsonify({"error": "Ongeldig bestandspad in project generatie."}), 500
            zf.writestr(arcname, content)
    buf.seek(0)

    return send_file(buf, mimetype="application/zip", as_attachment=True,
                      download_name=f"{folder_name}-source.zip")


@app.route("/api/build-apk", methods=["POST"])
def build_apk():
    """Start een asynchrone Gradle-build die een echte, installeerbare
    (debug-ondertekende) APK produceert voor een Web2App WebView-project.
    Vereist dat de Android SDK op deze server is geïnstalleerd en dat
    ANDROID_HOME/ANDROID_SDK_ROOT is ingesteld — zie
    backend/README-webview-setup.md.

    Retourneert direct een job_id; poll /api/build-apk/<job_id>/status
    voor de voortgang, en download via /api/build-apk/<job_id>/download
    zodra status 'done' is."""
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Verwacht JSON body."}), 400

    config = {
        "app_name": data.get("app_name", ""),
        "app_id": data.get("app_id", ""),
        "url": data.get("url", ""),
        "min_sdk": data.get("min_sdk", 21),
        "target_sdk": data.get("target_sdk", 34),
    }
    try:
        validate_webview_config(config)
    except ProjectConfigError as e:
        return jsonify({"error": str(e)}), 400

    app_name = config["app_name"].strip()
    app_id = config["app_id"].strip()
    url = config["url"].strip()

    try:
        files = generate_webview_project(
            app_name, app_id, url,
            min_sdk=int(config["min_sdk"]), target_sdk=int(config["target_sdk"]),
            show_progress_bar=bool(data.get("show_progress_bar", True)),
            allow_zoom=bool(data.get("allow_zoom", False)),
        )
    except Exception as e:
        app.logger.exception("Web2App generatie mislukt")
        return jsonify({"error": f"Genereren mislukt: {e}"}), 500

    job_id = uuid.uuid4().hex
    project_dir = BUILD_JOBS_DIR / job_id / "project"
    apk_output_path = BUILD_JOBS_DIR / job_id / "app-debug.apk"

    try:
        _write_files_to_disk(files, project_dir)
        _copy_gradle_wrapper(project_dir)
    except ProjectConfigError as e:
        return jsonify({"error": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500

    _set_job(job_id, status="queued", log="Build in de wachtrij...")
    thread = threading.Thread(
        target=_run_gradle_build, args=(job_id, project_dir, apk_output_path), daemon=True,
    )
    thread.start()

    return jsonify({"job_id": job_id, "status": "queued"}), 202


@app.route("/api/build-apk/<job_id>/status", methods=["GET"])
def build_apk_status(job_id):
    job = _get_job(job_id)
    if not job:
        return jsonify({"error": "Onbekende job_id."}), 404
    return jsonify({
        "job_id": job_id,
        "status": job.get("status", "unknown"),
        "error": job.get("error"),
        "log_tail": job.get("log", "")[-2000:] if job.get("log") else None,
    })


@app.route("/api/build-apk/<job_id>/download", methods=["GET"])
def build_apk_download(job_id):
    job = _get_job(job_id)
    if not job:
        return jsonify({"error": "Onbekende job_id."}), 404
    if job.get("status") != "done":
        return jsonify({"error": f"Build is nog niet klaar (status: {job.get('status')})."}), 409
    apk_path = Path(job.get("apk_path", ""))
    if not apk_path.exists():
        return jsonify({"error": "APK-bestand niet gevonden op de server."}), 410
    return send_file(apk_path, mimetype="application/vnd.android.package-archive",
                      as_attachment=True, download_name="app-debug.apk")


@app.route("/api/github-import", methods=["POST"])
def github_import():
    """Haalt metadata op van een GitHub repo (publiek of privé met token)."""
    data = request.get_json(silent=True) or {}
    repo_url = (data.get("repo_url") or "").strip()
    token = (data.get("token") or "").strip()

    if not repo_url:
        return jsonify({"error": "repo_url is verplicht."}), 400

    normalized_url = normalize_repo_url(repo_url)
    match = GITHUB_REPO_RE.match(normalized_url)
    if not match:
        return jsonify({
            "error": "Ongeldige GitHub URL. Verwacht een repo-link "
                     "(https://github.com/eigenaar/repo) of een GitHub Pages link "
                     "(https://eigenaar.github.io/repo)."
        }), 400

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
        "resolved_from_pages": normalized_url != repo_url,
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
