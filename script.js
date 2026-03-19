// 1. Icoon Preview functionaliteit
document.getElementById('icon-input').onchange = function(evt) {
    const file = evt.target.files[0];
    if (file) {
        const preview = document.getElementById('preview');
        // Maak een tijdelijke URL voor de afbeelding om te tonen
        preview.innerHTML = `<img src="${URL.createObjectURL(file)}" style="max-width: 100%; border-radius: 10px;">`;
    }
};

// 2. De Hoofdfunctie voor het bouwen van de app
async function generateApp() {
    const url = document.getElementById('github-link').value;
    const name = document.getElementById('app-name').value;
    const appId = document.getElementById('app-id').value; // Zorg dat je dit ID in je HTML hebt
    const iconFile = document.getElementById('icon-input').files[0];
    const status = document.getElementById('status');

    // Validatie: check of de belangrijkste velden zijn ingevuld
    if (!url || !name || !appId) {
        alert("Vul a.u.b. alle velden in (URL, Naam en App ID)!");
        return;
    }

    status.innerHTML = "⏳ <b>Bezig...</b> Je Chromebook (Linux) clonet nu de GitHub repo en bouwt de Android-structuur.";
    status.style.color = "#38bdf8";

    // We gebruiken FormData omdat we ook een bestand (icoon) willen versturen
    const formData = new FormData();
    formData.append('repoUrl', url);
    formData.append('appName', name);
    formData.append('appId', appId);
    if (iconFile) {
        formData.append('appIcon', iconFile);
    }

    try {
        // We maken verbinding met je eigen lokale server op poort 3000
        const response = await fetch('http://localhost:3000/build', {
            method: 'POST',
            body: formData // FormData regelt zelf de headers
        });

        const result = await response.json();

        if (response.ok) {
            status.innerHTML = `
                <div style="background: rgba(0, 255, 150, 0.2); padding: 15px; border-radius: 8px; border: 1px solid #00ffaa;">
                    ✅ <b>Succes!</b><br>
                    Project aangemaakt in: <br>
                    <code>${result.location}</code><br><br>
                    <b>Volgende stap:</b> Open Android Studio op je Chromebook en kies 'Open Project'.
                </div>
            `;
        } else {
            throw new Error(result.error || "Onbekende fout tijdens de build.");
        }

    } catch (error) {
        console.error("Build fout:", error);
        status.innerHTML = `<span style="color: #ff4d4d;">❌ <b>Fout:</b> De server reageert niet. Heb je 'node server.js' gestart in je Linux terminal?</span>`;
    }
}
