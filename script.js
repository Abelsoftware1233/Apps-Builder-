document.getElementById('app-icon').addEventListener('change', function(event) {
    const reader = new FileReader();
    reader.onload = function() {
        const preview = document.getElementById('icon-preview');
        preview.innerHTML = `<img src="${reader.result}" width="80" style="border-radius: 10px; margin-top: 10px;">`;
    }
    reader.readAsDataURL(event.target.files[0]);
});

document.getElementById('convert-btn').addEventListener('click', () => {
    const repoUrl = document.getElementById('github-url').value;
    const iconFile = document.getElementById('app-icon').files[0];
    const status = document.getElementById('status-log');

    if (!repoUrl) {
        status.innerHTML = "<span style='color: red;'>Please enter a GitHub URL.</span>";
        return;
    }

    status.innerHTML = "Processing conversion for Android...";

    // Logic for Echo AI repository integration
    const appData = {
        platform: "Android",
        source: repoUrl,
        iconProvided: iconFile ? iconFile.name : "Default",
        timestamp: new Date().toISOString()
    };

    console.log("App Configuration Ready:", appData);
    
    // Simulate a build process
    setTimeout(() => {
        status.innerHTML = `
            <div class="success-box">
                <strong>Success!</strong><br>
                Manifest created for: ${repoUrl}<br>
                <em>Ready to wrap in Capacitor/Cordova container.</em>
            </div>
        `;
    }, 2000);
});
