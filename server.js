const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const app = express();
const port = 3000;

app.use(express.json());

app.post('/convert', (req, res) => {
    const { repoUrl, appId } = req.body;
    const folderName = `app_${Date.now()}`;

    console.log(`Start conversie voor: ${repoUrl}`);

    // Stap 1: Clone de GitHub repo
    exec(`git clone ${repoUrl} ./builds/${folderName}`, (err) => {
        if (err) return res.status(500).send("Fout bij clonen GitHub.");

        // Stap 2: Voeg Capacitor (Android wrapper) toe
        const setupCmd = `
            cd ./builds/${folderName} && 
            npm install @capacitor/core @capacitor/cli && 
            npx cap init "${appId}" "EchoApp" --web-dir . && 
            npx cap add android && 
            npx cap copy android
        `;

        exec(setupCmd, (err) => {
            if (err) return res.status(500).send("Fout bij Android build.");
            
            res.send({
                message: "Android project succesvol gegenereerd!",
                path: `./builds/${folderName}/android`
            });
        });
    });
});

app.listen(port, () => console.log(`Converter server draait op http://localhost:${port}`));
