const express = require('express');
const db = require('./dbInteraction');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8088

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, "public/login.html"))
})

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, "public/register.html"));
})

app.get('/download', (req, res) => {
    res.sendFile(path.join(__dirname, "public/launcherdownload.html"));
});


app.post('/register/:username/:email/:password', async (req, res) => {
    const username = req.params.username;
    const email = req.params.email;
    const password = req.params.password;

    
    if(await db.register(username, email, password)){
        res.status(200).send('User registered');
    }else{
        res.status(401).send("Error during register sequence");
    }
});

app.post('/login/:email/:password', async (req, res) => {
    const email = req.params.email;
    const password = req.params.password;

    try{
        if(!await db.login(email, password)){
            res.status(401).send('Invalid credentials');

        }else{
            console.warn("[main.js:46]: Login successful")
            res.status(200).send('Login successful');
        }
    }catch(error){
        res.status(503).send("Error 503: Service (Database) unavailable. Error: " + error)
    }
});

app.get('/api/getVersions/:game/:email', async (req, res) => {
    const accountMail = req.params.email;
    const game = req.params.game;
    try {

        const jsonFilePath = path.join(__dirname, 'data', game, 'game-config.json');
        const rawData = fs.readFileSync(jsonFilePath, 'utf-8');
        const gameConfig = JSON.parse(rawData);

        // Validate the structure of the JSON
        if (!Array.isArray(gameConfig.builds)) {
            throw new Error("Invalid JSON structure: 'builds' is not an array");
        }

        // Retrieve the user from the database
        const user = await db.getUserByEmail(accountMail);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const userWave = user.wave;

        // Filter game builds based on the user's wave access
        const availableBuilds = gameConfig.builds.filter(build => build.requiredWaveAccess >= userWave);

        // Send only the filtered builds
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

app.listen(PORT, async () => {

    await db.init();
    console.log('Server is running on http://localhost:' + PORT);
});
