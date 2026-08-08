// Android App Pro Builder — Frontend logica
// Verbindt index.html met de Flask backend (app.py) op poort 5050.

const API_BASE = window.API_BASE || "http://localhost:5050";

let currentStep = 1;
let uploadedIconDataUrl = null;
let lastZipBlob = null;
let lastFolderName = "project";

// ---------- Stap-navigatie ----------

function goToStep(step) {
  if (step === 3) {
    // valideer verplichte velden voordat we naar de samenvatting gaan
    const appName = document.getElementById("appName").value.trim();
    const appId = document.getElementById("appId").value.trim();
    if (!appName) {
      alert("Vul een App Naam in.");
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(appId)) {
      alert("Vul een geldige App ID in, bv. com.echo.app");
      return;
    }
    renderSummary();
  }

  document.querySelectorAll(".step").forEach(el => el.classList.remove("active"));
  const target = document.getElementById(`step${step}`);
  if (target) target.classList.add("active");

  document.querySelectorAll(".prog-step").forEach(el => {
    const s = parseInt(el.dataset.step, 10);
    el.classList.remove("active", "done");
    if (s === step) el.classList.add("active");
    else if (s < step) el.classList.add("done");
  });

  currentStep = step;
}

// ---------- Tabs (Stap 1: GitHub / Leeg / Template) ----------

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
    });
  });

  document.querySelectorAll(".template-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".template-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
    });
  });

  // Icoon upload preview
  const iconInput = document.getElementById("iconFile");
  const fileDrop = document.getElementById("fileDrop");
  if (iconInput) {
    iconInput.addEventListener("change", handleIconFile);
  }
  if (fileDrop) {
    fileDrop.addEventListener("dragover", e => { e.preventDefault(); fileDrop.classList.add("dragover"); });
    fileDrop.addEventListener("dragleave", () => fileDrop.classList.remove("dragover"));
    fileDrop.addEventListener("drop", e => {
      e.preventDefault();
      fileDrop.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        iconInput.files = e.dataTransfer.files;
        handleIconFile();
      }
    });
  }
});

function handleIconFile() {
  const input = document.getElementById("iconFile");
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    uploadedIconDataUrl = e.target.result;
    const preview = document.getElementById("iconPreview");
    preview.innerHTML = `<img src="${uploadedIconDataUrl}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;" />`;
  };
  reader.readAsDataURL(file);
}

// ---------- GitHub import ----------

async function importGithubRepo() {
  const repoUrl = document.getElementById("repoUrl").value.trim();
  const token = document.getElementById("githubToken").value.trim();
  const statusEl = document.getElementById("importStatus");
  const btn = document.getElementById("importRepoBtn");

  if (!repoUrl) {
    statusEl.textContent = "Vul eerst een GitHub URL in.";
    statusEl.style.color = "var(--red, #ff5c5c)";
    return;
  }

  statusEl.textContent = "⏳ Repo wordt opgehaald...";
  statusEl.style.color = "";
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/github-import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_url: repoUrl, token }),
    });
    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = `❌ ${data.error || "Onbekende fout"}`;
      statusEl.style.color = "var(--red, #ff5c5c)";
      return;
    }

    document.getElementById("appName").value = data.suggested_app_name || "";
    document.getElementById("appId").value = data.suggested_app_id || "";

    statusEl.textContent = `✅ Geïmporteerd: ${data.full_name}${data.private ? " (privé)" : ""}`;
    statusEl.style.color = "var(--cyan, #22d3ee)";
  } catch (err) {
    statusEl.textContent = `❌ Kon backend niet bereiken: ${err.message}. Draait app.py op ${API_BASE}?`;
    statusEl.style.color = "var(--red, #ff5c5c)";
  } finally {
    btn.disabled = false;
  }
}

// ---------- Samenvatting stap 3 ----------

function getSelectedFeatures() {
  const ids = ["internet", "camera", "storage", "location", "push", "bluetooth", "biometric", "firebase"];
  return ids.filter(id => document.getElementById(`feat-${id}`)?.checked);
}

function getSelectedArch() {
  return document.querySelector('input[name="arch"]:checked')?.value || "mvvm";
}

function getSelectedLang() {
  return document.querySelector('input[name="lang"]:checked')?.value || "kotlin";
}

function renderSummary() {
  const appName = document.getElementById("appName").value.trim();
  const appId = document.getElementById("appId").value.trim();
  const minSdk = document.getElementById("minSdk").value;
  const targetSdk = document.getElementById("targetSdk").value;
  const features = getSelectedFeatures();
  const arch = getSelectedArch();
  const lang = getSelectedLang();

  document.getElementById("summary").innerHTML = `
    <div class="summary-row"><strong>App naam:</strong> ${escapeHtml(appName)}</div>
    <div class="summary-row"><strong>App ID:</strong> ${escapeHtml(appId)}</div>
    <div class="summary-row"><strong>SDK:</strong> min ${minSdk} → target ${targetSdk}</div>
    <div class="summary-row"><strong>Taal:</strong> ${lang === "kotlin" ? "Kotlin" : "Java"}</div>
    <div class="summary-row"><strong>Architectuur:</strong> ${arch.toUpperCase()}</div>
    <div class="summary-row"><strong>Features:</strong> ${features.length ? features.join(", ") : "geen"}</div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Project genereren ----------

async function generateProject() {
  const btn = document.getElementById("generateBtn");
  const btnText = document.getElementById("genBtnText");
  const originalText = btnText.textContent;

  const payload = {
    app_name: document.getElementById("appName").value.trim(),
    app_id: document.getElementById("appId").value.trim(),
    lang: getSelectedLang(),
    arch: getSelectedArch(),
    min_sdk: parseInt(document.getElementById("minSdk").value, 10),
    target_sdk: parseInt(document.getElementById("targetSdk").value, 10),
    features: getSelectedFeatures(),
  };

  btn.disabled = true;
  btnText.textContent = "⏳ Genereren...";

  try {
    const res = await fetch(`${API_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let message = "Onbekende fout bij genereren.";
      try {
        const errData = await res.json();
        message = errData.error || message;
      } catch (_) { /* geen JSON body */ }
      throw new Error(message);
    }

    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    lastFolderName = match ? match[1].replace(/\.zip$/, "") : payload.app_name.replace(/\s+/g, "");

    lastZipBlob = await res.blob();
    showResult(payload);
  } catch (err) {
    alert(`❌ Genereren mislukt: ${err.message}\n\nControleer dat de backend draait op ${API_BASE} (app.py).`);
  } finally {
    btn.disabled = false;
    btnText.textContent = originalText;
  }
}

function showResult(payload) {
  document.getElementById("resultAppName").textContent =
    `${payload.app_name} (${payload.app_id})`;

  const isKotlin = payload.lang === "kotlin";
  const ext = isKotlin ? "kt" : "java";
  const pkgPath = payload.app_id.split(".").join("/");

  document.getElementById("fileTree").innerHTML = `
    <pre>${lastFolderName}/
├── app/
│   ├── src/main/
│   │   ├── java/${pkgPath}/
│   │   │   └── MainActivity.${ext}
│   │   ├── res/
│   │   └── AndroidManifest.xml
│   └── build.gradle
├── build.gradle
├── settings.gradle
├── README.md
└── .gitignore</pre>
  `;

  document.getElementById("setupSteps").innerHTML = `
    <ol>
      <li>Pak de ZIP uit in een map naar keuze.</li>
      <li>Open de map in <strong>Android Studio</strong> (File → Open).</li>
      <li>Wacht tot Gradle sync is voltooid.</li>
      <li>Klik ▶ Run om de app te bouwen en te starten.</li>
    </ol>
  `;

  document.querySelectorAll(".step").forEach(el => el.classList.remove("active"));
  document.getElementById("stepResult").classList.add("active");

  const downloadBtn = document.getElementById("downloadBtn");
  downloadBtn.onclick = () => {
    if (!lastZipBlob) return;
    const url = URL.createObjectURL(lastZipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lastFolderName}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
}

function copyStructure() {
  const pre = document.querySelector("#fileTree pre");
  if (!pre) return;
  navigator.clipboard.writeText(pre.textContent).then(() => {
    alert("Structuur gekopieerd naar klembord.");
  });
}

function restartBuilder() {
  document.querySelectorAll(".step").forEach(el => el.classList.remove("active"));
  document.getElementById("step1").classList.add("active");
  document.querySelectorAll(".prog-step").forEach(el => {
    el.classList.remove("active", "done");
    if (el.dataset.step === "1") el.classList.add("active");
  });
  currentStep = 1;
  lastZipBlob = null;
}
