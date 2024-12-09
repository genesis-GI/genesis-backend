const express = require('express');
const db = require('./dbInteraction');
const path = require('path');
const cookieParser = require('cookie-parser');
const { Console } = require('console');

const app = express();
const PORT = 8080;

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());


app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, "public/login.html"));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, "public/register.html"));
});

// Middleware to protect the / route
const checkAuth = (req, res, next) => {
    const authToken = req.cookies.auth;

    // Example validation for authToken
    if (authToken === 'valid-auth-token') {
        return next();
    }
    res.status(403).sendFile('<link rel="stylesheet" href="/css/styles.css"> Access denied. Please log in.');
};

// Protected route
app.get('/', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
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
            console.warn("[index.js:46]: Login successful");
            
            // Set a cookie with a sample token (use secure tokens in real applications)
            

            // Redirect to the index page
            try{
                res.cookie('auth', 'valid-auth-token', { httpOnly: true, maxAge: 3600000 });
                res.redirect('http://localhost:8080/index');
            }catch(error)
            {
                console.error("[index.js:71]: Error: " + error);
            }
            //res.status(200).send('Login successful');
        }
    } catch (error) {
        res.status(503).send("Error 503: Service (Database) unavailable. Error: " + error);
    }
});

app.post('/logout', (req, res) => {
    res.clearCookie('auth');
    //res.send('Logged out successfully');
    res.redirect('/');
});

app.get('/test', async (req, res) => {
    res.redirect('/index');
});

app.listen(PORT, async () => {
    await db.init();
    console.log('Server is running on http://localhost:' + PORT);
});