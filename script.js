// Preview van icoon
document.getElementById('icon-input').onchange = function(evt) {
    const [file] = this.files;
    if (file) {
        document.getElementById('preview').innerHTML = `<img src="${URL.createObjectURL(file)}">`;
    }
};

async function generateApp() {
    const url = document.getElementById('github-link').value;
    const name = document.getElementById('app-name').value;
    const status = document.getElementById('status');

    if (!url || !name) {
        alert("Vul alles in!");
        return;
    }

    status.innerHTML = "⏳ Bezig met voorbereiden...";

    // Omdat we geen server hebben, maken we een 'App Manifest' 
    // Dit is een JSON bestand dat Android begrijpt.
    const appConfig = {
        "name": name,
        "start_url": url,
        "display": "standalone",
        "orientation": "portrait",
        "platform": "android"
    };

    // We maken een downloadbaar bestand voor je aan direct in de browser
    const blob = new Blob([JSON.stringify(appConfig, null, 2)], {type : 'application/json'});
    const downloadUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = "android-config.json";
    
    setTimeout(() => {
        status.innerHTML = "✅ Configuratie gegenereerd!<br>Download start nu...";
        link.click();
        
        status.innerHTML += "<br><br><strong>Stap 2:</strong> Ga naar een online builder (zoals PWA2APK) en upload dit bestand.";
    }, 1500);
}
