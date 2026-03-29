/**
 * Android App Pro Builder - Client Side Logic
 * Volledig werkend met Icoon Upload en FormData
 */

// 1. Icoon Preview Logica
document.getElementById('icon-input')?.addEventListener('change', function(evt) {
    const [file] = this.files;
    const preview = document.getElementById('preview');
    
    if (file && preview) {
        // Maak een tijdelijke URL voor de afbeelding voor de browser
        const imgUrl = URL.createObjectURL(file);
        preview.innerHTML = `
            <div class="preview-wrapper" style="animation: fadeIn 0.5s ease;">
                <img src="${imgUrl}" alt="App Icon Preview" 
                     style="width: 80px; height: 80px; object-fit: cover; border-radius: 18px; border: 2px solid var(--primary); box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);">
                <p style="font-size: 12px; color: var(--text-dim); margin-top: 8px;">Icoon geselecteerd</p>
            </div>`;
    }
});

// 2. Hoofdfunctie voor het genereren van het project
async function buildNow() {
    // Elementen ophalen
    const repo = document.getElementById('repo').value.trim();
    const name = document.getElementById('name').value.trim();
    const appId = document.getElementById('app-id').value.trim();
    const iconFile = document.getElementById('icon-input').files[0]; // Pak het bestand
    
    const status = document.getElementById('status');
    const loader = document.getElementById('loader');
    const btn = document.getElementById('build-btn');

    // Stap 1: Validatie
    if (!repo || !name || !appId) {
        showStatus("⚠️ Vul alsjeblieft alle velden in!", "error");
        return;
    }

    if (!appId.includes('.')) {
        showStatus("⚠️ Ongeldig App ID. Gebruik bijv: com.echo.app", "error");
        return;
    }

    // Stap 2: UI Voorbereiden (Loading state)
    btn.disabled = true;
    btn.style.opacity = "0.7";
    btn.innerHTML = "<span>BEZIG MET GENEREREN...</span>";
    loader.style.display = "block";
    status.innerHTML = "<em>Project wordt voorbereid in de Linux-container...</em>";

    // Stap 3: Data voorbereiden met FormData (nodig voor bestanden)
    const formData = new FormData();
    formData.append('repoUrl', repo);
    formData.append('appName', name);
    formData.append('appId', appId);
    if (iconFile) {
        formData.append('icon', iconFile);
    }

    try {
        // Stap 4: API Call naar Node.js server
        const response = await fetch('http://localhost:3000/build', {
            method: 'POST',
            body: formData // Geen 'Content-Type' header nodig, FormData zet deze automatisch goed
        });

        const result = await response.json();

        if (response.ok) {
            // Stap 5: Succes Feedback
            status.innerHTML = `
                <div class="success-box" style="animation: slideUp 0.4s ease-out; background: rgba(74, 222, 128, 0.1); padding: 15px; border-radius: 12px; border: 1px solid #4ade80;">
                    <b style="color: #4ade80; display: block; margin-bottom: 8px;">✅ Project Succesvol Klaargezet!</b>
                    <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; text-align: left;">
                        <code style="font-size: 11px; color: #38bdf8; word-break: break-all;">${result.location}</code>
                    </div>
                    <p style="margin-top: 15px; font-size: 13px; color: var(--text-main);">
                        Open nu <b>Android Studio</b>, kies 'Open' en selecteer de map hierboven.
                    </p>
                </div>`;
        } else {
            showStatus(`❌ Server Fout: ${result.error || 'Onbekende fout'}`, "error");
        }

    } catch (error) {
        // Stap 6: Connectie Fout (Server staat uit)
        status.innerHTML = `
            <div style="color: #f87171; background: rgba(248, 113, 113, 0.1); padding: 15px; border-radius: 12px; border: 1px solid rgba(248, 113, 113, 0.3);">
                <b>❌ Server Offline</b><br>
                <p style="font-size: 12px; margin-top: 5px;">
                    Start je backend in de terminal met:<br>
                    <code>node server.js</code>
                </p>
            </div>`;
    } finally {
        // Stap 7: UI Herstellen
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.innerHTML = "<span>PROJECT GENEREREN</span>";
        loader.style.display = "none";
    }
}

/**
 * Helper voor statusberichten
 */
function showStatus(message, type) {
    const status = document.getElementById('status');
    const color = type === "error" ? "#f87171" : "#38bdf8";
    status.innerHTML = `<span style="color: ${color}; font-weight: 500;">${message}</span>`;
}
