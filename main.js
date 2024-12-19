const express = require('express');
const db = require('./dbInteraction');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 8088;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, "public/login.html"));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, "public/register.html"));
});

app.get('/download', (req, res) => {
    res.sendFile(path.join(__dirname, "public/launcherdownload.html"));
});

app.post('/register/:username/:email/:password', async (req, res) => {
    const username = req.params.username;
    const email = req.params.email;
    const password = req.params.password;

    if (await db.register(username, email, password)) {
        res.status(200).send('User registered');
    } else {
        res.status(401).send("Error during register sequence");
    }
});

app.post('/login/:email/:password', async (req, res) => {
    const email = req.params.email;
    const password = req.params.password;

    try {
        if (!await db.login(email, password)) {
            res.status(401).send('Invalid credentials');
        } else {
            console.warn("[main.js:46]: Login successful");
            res.status(200).send('Login successful');
        }
    } catch (error) {
        res.status(503).send("Error 503: Service (Database) unavailable. Error: " + error);
    }
});

app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, "public/temp.html"));
})

app.get('/api/getVersions/:game/:email', async (req, res) => {
    const accountMail = req.params.email;
    const game = req.params.game;
    try {
        const jsonFilePath = path.join(__dirname, 'data', game, 'game-config.json');
        const rawData = fs.readFileSync(jsonFilePath, 'utf-8');
        const gameConfig = JSON.parse(rawData);

        if (!Array.isArray(gameConfig.builds)) {
            throw new Error("Invalid JSON structure: 'builds' is not an array");
        }

        const user = await db.getUserByEmail(accountMail);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const userWave = user.wave;
        const availableBuilds = gameConfig.builds.filter(build => build.requiredWaveAccess >= userWave);

        return res.json({
            email: accountMail,
            waveAccess: userWave,
            allowedBuilds: availableBuilds,
        });
    } catch (error) {
        console.error("[main.js]: Error reading game-config.json or processing request:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// New endpoint to calculate checksums for files
app.get('/api/getChecksums/:game/:version', async (req, res) => {
    const game = req.params.game;
    const version = req.params.version;

    const buildPath = path.join(__dirname, 'data', game, 'builds', version);

    try {
        if (!fs.existsSync(buildPath)) {
            return res.status(404).json({ error: "Build path not found" });
        }

        const calculateChecksums = (dir) => {
            let checksums = {};

            const files = fs.readdirSync(dir, { withFileTypes: true });
            files.forEach(file => {
                const fullPath = path.join(dir, file.name);

                if (file.isDirectory()) {
                    checksums[file.name] = calculateChecksums(fullPath);
                } else {
                    const fileBuffer = fs.readFileSync(fullPath);
                    const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
                    checksums[file.name] = hash;
                }
            });

            return checksums;
        };

        const result = calculateChecksums(buildPath);
        res.json({
            game,
            version,
            checksums: result
        });
    } catch (error) {
        console.error("Error calculating checksums:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/api/download/:game/:version', async (req, res) => {
    const game = req.params.game;
    const version = req.params.version;

    // Ensure version is provided
    if (!version) {
        return res.status(400).json({ error: "Version must be specified for download" });
    }

    const buildPath = path.join(__dirname, 'data', game, 'builds', version);

    try {
        // Check if the build path exists
        if (!fs.existsSync(buildPath)) {
            return res.status(404).json({ error: "Requested game version not found" });
        }

        // Verify that it's a directory
        const stats = fs.statSync(buildPath);
        if (!stats.isDirectory()) {
            return res.status(400).json({ error: "Invalid build path, not a directory" });
        }

        // Serve the folder as a downloadable file
        res.setHeader('Content-Disposition', `attachment; filename=${game}-${version}.zip`);
        res.setHeader('Content-Type', 'application/zip');

        // Stream folder contents for download
        const zipStream = require('archiver')('zip', { zlib: { level: 9 } });

        zipStream.on('error', (err) => {
            console.error("Error creating ZIP stream:", err);
            res.status(500).json({ error: "Internal Server Error" });
        });

        zipStream.pipe(res);
        zipStream.directory(buildPath, false);
        await zipStream.finalize();
    } catch (error) {
        console.error("Error processing download request:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(PORT, async () => {
    await db.init();
    console.log('Server is running on http://localhost:' + PORT);
});
