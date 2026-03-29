/**
 * Android App Pro Builder - Client Side Logic
 * Geoptimaliseerd voor touch en Chromebook Linux omgevingen.
 */

// Icoon Preview Logica
document.getElementById('icon-input')?.addEventListener('change', function(evt) {
    const [file] = this.files;
    const preview = document.getElementById('preview');
    
    if (file && preview) {
        // Maak een tijdelijke URL voor de afbeelding
        const imgUrl = URL.createObjectURL(file);
        preview.innerHTML = `
            <div class="preview-wrapper" style="animation: fadeIn 0.5s ease;">
                <img src="${imgUrl}" alt="App Icon Preview" 
                     style="width: 80px; height: 80px; object-fit: cover; border-radius: 18px; border: 2px solid var(--primary); box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);">
                <p style="font-size: 12px; color: var(--text-dim); margin-top: 8px;">App Icoon geladen</p>
            </div>`;
    }
});

async function buildNow() {
    // Elementen ophalen
    const repo = document.getElementById('repo').value.trim();
    const name = document.getElementById('name').value.trim();
    const appId = document.getElementById('app-id').value.trim();
    const status = document.getElementById('status');
    const loader = document.getElementById('loader');
    const btn = document.getElementById('build-btn');

    // 1. Validatie
    if (!repo || !name || !appId) {
        showStatus("⚠️ Vul alsjeblieft alle velden in!", "error");
        return;
    }

    if (!appId.includes('.')) {
        showStatus("⚠️ Ongeldig App ID. Gebruik bijv: com.bedrijf.app", "error");
        return;
    }

    // 2. UI Voorbereiden voor laden
    btn.disabled = true;
    btn.style.opacity = "0.7";
    btn.innerHTML = "<span>BEZIG MET GENEREREN...</span>";
    loader.style.display = "block";
    status.innerHTML = "<em>De Linux-container bereidt de mappenstructuur voor...</em>";

    try {
        // 3. API Call naar Node.js server
        const response = await fetch('http://localhost:3000/build', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                repoUrl: repo, 
                appName: name, 
                appId: appId 
            })
        });

        const result = await response.json();

        if (response.ok) {
            // 4. Succes Feedback
            status.innerHTML = `
                <div class="success-box" style="animation: slideUp 0.4s ease-out;">
                    <b style="color: #4ade80; display: block; margin-bottom: 8px;">✅ Project Succesvol Klaargezet!</b>
                    <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; text-align: left;">
                        <code style="font-size: 11px; color: #38bdf8; word-break: break-all;">${result.location}</code>
                    </div>
                    <p style="margin-top: 15px; font-size: 13px;">
                        Stap 2: Start <b>Android Studio</b> en kies 'Open Project'. Selecteer de bovenstaande map.
                    </p>
                </div>`;
        } else {
            showStatus(`❌ Server Fout: ${result.error || 'Onbekende fout'}`, "error");
        }

    } catch (error) {
        // 5. Connectie Fout
        status.innerHTML = `
            <div style="color: #f87171; background: rgba(248, 113, 113, 0.1); padding: 15px; border-radius: 12px; border: 1px solid rgba(248, 113, 113, 0.3);">
                <b>❌ Server Offline</b><br>
                <p style="font-size: 12px; margin-top: 5px;">
                    Start je backend door in je Linux terminal te typen:<br>
                    <code>node server.js</code>
                </p>
            </div>`;
    } finally {
        // 6. UI Herstellen
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.innerHTML = "<span>PROJECT GENEREREN</span>";
        loader.style.display = "none";
    }
}

// Helper functie voor snelle statusberichten
function showStatus(message, type) {
    const status = document.getElementById('status');
    const color = type === "error" ? "#f87171" : "#38bdf8";
    status.innerHTML = `<span style="color: ${color}; font-weight: 500;">${message}</span>`;
}
