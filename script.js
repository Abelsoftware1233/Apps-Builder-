// 1. Icoon Voorbeeldweergave
document.getElementById('app-icon').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('icon-preview');
            preview.innerHTML = `<img src="${e.target.result}" width="80" style="border-radius: 12px; margin-top: 10px; border: 2px solid #3498db;">`;
        };
        reader.readAsDataURL(file);
    }
});

// 2. Conversie Logica (Gecombineerd)
document.getElementById('convert-btn').addEventListener('click', async () => {
    const repoUrl = document.getElementById('github-url').value;
    const iconFile = document.getElementById('app-icon').files[0];
    const status = document.getElementById('status-log');

    // Validatie
    if (!repoUrl) {
        status.innerHTML = "<span style='color: #e74c3c;'>Voer a.u.b. een GitHub URL in.</span>";
        return;
    }

    status.innerHTML = "<strong>Status:</strong> Bezig met verbinden met build-server...";

    try {
        // We sturen de aanvraag naar je Node.js backend
        const response = await fetch('http://localhost:3000/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                repoUrl: repoUrl, 
                appId: "com.echo.myapp", // Dit kun je eventueel ook een inputveld maken
                iconName: iconFile ? iconFile.name : "default.png"
            })
        });

        if (!response.ok) throw new Error('Server fout');

        const result = await response.json();
        
        // Succes melding
        status.innerHTML = `
            <div class="success-box" style="background: #dff9fb; color: #0984e3; padding: 15px; border-radius: 8px; border: 1px solid #74b9ff;">
                <strong>Build Succesvol!</strong><br>
                ${result.message}<br>
                <small>Locatie: ${result.path}</small>
            </div>
        `;

    } catch (error) {
        console.error("Fout:", error);
        status.innerHTML = "<span style='color: #e74c3c;'><strong>Fout:</strong> Server niet bereikbaar. Start je server.js op poort 3000.</span>";
    }
});
