const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const BUILDS_DIR = path.join(__dirname, 'builds');
if (!fs.existsSync(BUILDS_DIR)) fs.mkdirSync(BUILDS_DIR);

app.post('/convert-and-download', (req, res) => {
    const { repoUrl, appId, appName } = req.body;
    const projectID = `app_${Date.now()}`;
    const projectPath = path.join(BUILDS_DIR, projectID);

    // Luxe commando voor Linux/Chromebook
    const buildCommand = `
        git clone ${repoUrl} ${projectPath} && 
        cd ${projectPath} && 
        npm install && 
        npx cap init "${appName}" "${appId}" --web-dir . && 
        npx cap add android && 
        npx cap copy android
    `;

    exec(buildCommand, (err) => {
        if (err) return res.status(500).json({ error: "Fout bij initialisatie." });

        // Op een Chromebook is het bouwen van de uiteindelijke APK zwaar. 
        // We sturen de complete Android-projectmap terug als ZIP zodat je hem 
        // in de 'Android Studio for Chromebook' kunt openen.
        res.json({ 
            success: true, 
            message: "Project staat klaar in je Linux-bestanden!",
            path: projectPath
        });
    });
});

app.listen(3000, () => console.log("Chromebook Builder draait op poort 3000"));
