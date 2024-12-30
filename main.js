const express = require('express');
const db = require('./dbInteraction');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const spectrum = require('./spectrum')

const app = express();
const PORT = 8088;

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());  // Enable cookie parsing
app.use(express.json());  // Add this line to parse JSON request bodies

async function isLoggedIn(req) {
    const { email, username, password } = req.cookies;
    if (!email || !username || !password) {
        return false;
    }
    
    return await db.login(email, password);
}

app.get('/', async (req, res) => {
    if (!await isLoggedIn(req)) {
        return res.sendFile(path.join(__dirname, 'public', 'landing.html'));
    }
    res.sendFile(path.join(__dirname, 'public', 'loggedIn.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, "public/login.html"));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, "public/register.html"));
});

// Protect the download route with cookies
app.get('/download', async (req, res) => {
    if (!await isLoggedIn(req)) {
        return res.status(403).send('Access forbidden: You must be logged in');
    }
    res.sendFile(path.join(__dirname, "public/launcherdownload.html"));
});

// New /spectrum route with login check
app.get('/spectrum', async (req, res) => {
    if (!await isLoggedIn(req)) {
        return res.status(403).send('Access forbidden: You must be logged in');
    }
    res.sendFile(path.join(__dirname, "public/spectrum.html"));
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

app.get('/performance', (req, res) => {
    res.sendFile(path.join(__dirname, "public/Genesis-website-performance-report-2.html"));
});

app.get('/api/getVersions/:game/:email', async (req, res) => {
    const accountMail = req.params.email;
    const game = req.params.game;
    if(game.toLowerCase() !== 'genesis'){
        return res.status(400).json({ error: "Invalid game (at the moment)" });
    }else{

    
    try {

        const gameConfig = await db.getGameConfig();

        // Überprüfen, ob `gameConfig` als String vorliegt und parsbar ist
        if (!gameConfig || typeof gameConfig !== 'object' || !gameConfig.builds) {
            throw new Error("Invalid raw data structure: 'gameConfig' missing or invalid");
        }

        // Sicherstellen, dass 'builds' ein Array ist
        if (!Array.isArray(gameConfig.builds)) {
            throw new Error("Invalid JSON structure: 'builds' is not an array");
        }

        // Nutzerinformationen abrufen
        const user = await db.getUserByEmail(accountMail);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Zugelassene Builds filtern
        const userWave = user.wave;
        const availableBuilds = gameConfig.builds.filter(build => userWave <= build.requiredWaveAccess);

        return res.json({
            email: accountMail,
            waveAccess: userWave,
            allowedBuilds: availableBuilds,
        });
    } catch (error) {
        console.error("[main.js]: Error processing request:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }}
});

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

app.post('/login/:email/:password', async (req, res) => {
    const email = req.params.email;
    const password = req.params.password;

    try {
        if (!await db.login(email, password)) {
            res.status(401).send('Invalid credentials');
        } else {
            const user = await db.getUserByEmail(email);
            res.cookie('email', email, { httpOnly: true, secure: true }); // secure should be true in production
            res.cookie('username', user.username, { httpOnly: true, secure: true });
            res.cookie('password', password, { httpOnly: true, secure: true }); // Not recommended to store plaintext passwords in cookies
            res.cookie('admin', user.admin, { httpOnly: true, secure: true });
            res.status(200).send('Login successful');
        }
    } catch (error) {
        res.status(503).send("Error 503: Service (Database) unavailable. Error: " + error);
    }
});

app.get('/spectrum/motd/:channel', async(req, res) => {
    const channel = req.params.channel;

    res.send(await spectrum.getMOTD(channel))
})

app.post('/spectrum/motd/:channel', async(req, res) => {
    if (!await isLoggedIn(req)) {
        return res.status(403).send('Access forbidden: You must be logged in');
    }
    const channel = req.params.channel;
    const { message } = req.body;
    const existingChannel = await spectrum.getChannel(channel);
    if (!existingChannel) {
        return res.status(404).send('Channel not found');
    }
    await spectrum.setMOTD(message, channel);
    res.send('Channel MOTD updated successfully');
});

app.post('/spectrum/createChannel/:channel', async(req, res) => {
    if (!await isLoggedIn(req)) {
        return res.status(403).send('Access forbidden: You must be logged in');
    }
    const channel = req.params.channel;
    const existingChannel = await spectrum.getChannel(channel);
    if (existingChannel) {
        return res.status(400).send('Channel already exists');
    }
    await spectrum.createChannel(channel);
    res.send('Channel created successfully');
});

app.delete('/spectrum/deleteChannel/:channel', async(req, res) => {
    if (!await isLoggedIn(req)) {
        return res.status(403).send('Access forbidden: You must be logged in');
    }
    const channel = req.params.channel;
    const existingChannel = await spectrum.getChannel(channel);
    if (!existingChannel) {
        return res.status(404).send('Channel not found');
    }
    await spectrum.deleteChannel(channel);
    res.send('Channel deleted successfully');
});

app.post('/spectrum/starChannel/:channel', async(req, res) => {
    if (!await isLoggedIn(req)) {
        return res.status(403).send('Access forbidden: You must be logged in');
    }
    const { email } = req.cookies;
    const channel = req.params.channel;
    const { isStarred } = req.body;
    try {
        await spectrum.starChannel(email, channel, isStarred);
        res.send('Channel star status updated successfully');
    } catch (error) {
        console.error('Error updating star status:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/spectrum/starredChannels/:email', async(req, res) => {
    if (!await isLoggedIn(req)) {
        return res.status(403).send('Access forbidden: You must be logged in');
    }
    const email = req.params.email;
    try {
        const starredChannels = await spectrum.getStarredChannels(email);
        res.json(starredChannels);
    } catch (error) {
        console.error('Error fetching starred channels:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/spectrum/users', async (req, res) => {
    const users = await spectrum.getUsers();
    res.json(users);
});

app.get('/spectrum/currentUser', async (req, res) => {
    if (!await isLoggedIn(req)) {
        return res.status(403).send('Access forbidden: You must be logged in');
    }
    const { email, username } = req.cookies;
    const user = await db.getUserByEmail(email);
    res.json({ email, username, admin: user.admin });
});

app.get('/spectrum/channels', async (req, res) => {
    const channels = await spectrum.getChannels();
    res.json(channels);
});

app.get('/spectrum/motd/updates/:channel', async (req, res) => {
    if (!await isLoggedIn(req)) {
        return res.status(403).send('Access forbidden: You must be logged in');
    }
    const channel = req.params.channel;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    spectrum.listenForMOTDUpdates(channel, (motdInfos) => {
        res.write(`data: ${JSON.stringify(motdInfos)}\n\n`);
    });
});

app.get('/spectrum/channels/updates', async (req, res) => {
    if (!await isLoggedIn(req)) {
        return res.status(403).send('Access forbidden: You must be logged in');
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    spectrum.listenForChannelUpdates((channels) => {
        res.write(`data: ${JSON.stringify(channels)}\n\n`);
    });
});

app.get('/spectrum/starredChannels/updates/:email', async (req, res) => {
    if (!await isLoggedIn(req)) {
        return res.status(403).send('Access forbidden: You must be logged in');
    }
    const email = req.params.email;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    spectrum.listenForStarredChannelUpdates(email, (starredChannels) => {
        res.write(`data: ${JSON.stringify(starredChannels)}\n\n`);
    });
});

app.get('/logout', (req, res) => {
    res.clearCookie('email');
    res.clearCookie('username');
    res.clearCookie('password');
    res.clearCookie('admin');
    res.redirect('/');
});

app.listen(PORT, async () => {
    await db.init();
    console.log('Server is running on http://localhost:' + PORT);
});
