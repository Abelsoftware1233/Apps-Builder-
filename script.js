document.getElementById('convert-btn').addEventListener('click', async () => {
    const repoUrl = document.getElementById('github-url').value;
    const appId = document.getElementById('app-id').value;
    const iconFile = document.getElementById('app-icon').files[0];
    const status = document.getElementById('status-log');

    if (!repoUrl || !appId) {
        status.innerHTML = "<span style='color:red;'>Vul alle velden in!</span>";
        return;
    }

    // Gebruik FormData om zowel tekst als het bestand te versturen
    const formData = new FormData();
    formData.append('repoUrl', repoUrl);
    formData.append('appId', appId);
    formData.append('appName', "EchoGeneratedApp");
    if (iconFile) {
        formData.append('appIcon', iconFile);
    }

    status.innerHTML = "<strong>Bezig...</strong> De server clonet nu je repo en bouwt de Android-bestanden.";

    try {
        const response = await fetch('http://localhost:3000/convert', {
            method: 'POST',
            body: formData // Geen headers nodig, FormData doet dit zelf
        });

        const result = await response.json();
        status.innerHTML = `
            <div class="success-box">
                <strong>Klaar!</strong><br>
                App ID: ${result.appId}<br>
                Project staat klaar in: <br><code>${result.path}</code>
            </div>
        `;
    } catch (error) {
        status.innerHTML = "<span style='color:red;'>Fout: Kan geen verbinding maken met de server.</span>";
    }
});
