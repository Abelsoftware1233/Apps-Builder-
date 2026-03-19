// Icoon voorbeeld
document.getElementById('icon-input').onchange = function(evt) {
    const [file] = this.files;
    if (file) {
        document.getElementById('preview').innerHTML = 
            `<img src="${URL.createObjectURL(file)}" style="width:100%; border-radius:15px; border: 2px solid #38bdf8;">`;
    }
};

async function generateApp() {
    const url = document.getElementById('github-link').value;
    const name = document.getElementById('app-name').value;
    const appId = document.getElementById('app-id').value;
    const status = document.getElementById('status');
    const btn = document.querySelector('button');

    if (!url || !name || !appId) {
        alert("Vul alle velden in!");
        return;
    }

    // Visuele feedback
    btn.disabled = true;
    btn.innerHTML = "⏳ Bezig met bouwen...";
    status.innerHTML = "De Linux-omgeving clonet nu je GitHub repository...";

    try {
        const response = await fetch('http://localhost:3000/build', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ repoUrl: url, appName: name, appId: appId })
        });

        const result = await response.json();

        if (response.ok) {
            status.innerHTML = `
                <div style="background:#1e293b; padding:15px; border-radius:10px; border:1px solid #38bdf8; margin-top:20px;">
                    <b style="color:#00ffaa;">✅ Project Gereed!</b><br>
                    <small>Pad: ${result.location}</small><br><br>
                    <b>Stap 2:</b> Open nu Android Studio en klik op 'Open Project'.
                </div>`;
        } else {
            status.innerHTML = "❌ Fout: De server kon het project niet maken.";
        }
    } catch (error) {
        status.innerHTML = "<span style='color:#ff4d4d;'>❌ Server offline! Open je Terminal en typ: <code>node server.js</code></span>";
    } finally {
        btn.disabled = false;
        btn.innerHTML = "CONVERTEER NU";
    }
}
