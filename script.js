// Preview van icoon (Direct in de browser)
document.getElementById('icon-input').onchange = function(evt) {
    const [file] = this.files;
    if (file) {
        document.getElementById('preview').innerHTML = `<img src="${URL.createObjectURL(file)}" style="width:100%; border-radius:10px;">`;
    }
};

async function generateApp() {
    const url = document.getElementById('github-link').value;
    const name = document.getElementById('app-name').value;
    const appId = document.getElementById('app-id').value;
    const status = document.getElementById('status');

    if (!url || !name || !appId) {
        alert("Vul a.u.b. alle velden in!");
        return;
    }

    status.innerHTML = "⏳ Verbinding maken met je Chromebook Linux server...";

    // We sturen de opdracht naar je eigen Linux-omgeving op je Chromebook
    try {
        const response = await fetch('http://localhost:3000/build', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                repoUrl: url,
                appName: name,
                appId: appId
            })
        });

        const result = await response.json();

        if (response.ok) {
            status.innerHTML = `✅ <b>Succes!</b><br>Project staat klaar in Linux map:<br><code>${result.location}</code>`;
        } else {
            status.innerHTML = "❌ Fout: De server kon het project niet clonen.";
        }
    } catch (error) {
        status.innerHTML = "❌ <b>Server offline!</b><br>Open je Terminal en typ: <code>node server.js</code>";
    }
}
