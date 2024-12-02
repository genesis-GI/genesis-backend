const express = require('express');
const db = require('./dbInteraction');
const path = require('path');

const app = express();
const PORT = 8080



app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
    // res.status(500).send('Error 500: This is a invalid path!');
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, "public/login.html"))
})

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, "public/register.html"));
})


app.post('/register/:username/:email/:password', (req, res) => {
    const username = req.params.username;
    const email = req.params.email;
    const password = req.params.password;


    if(db.register(username, email, password)){
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
            res.status(200).send('Login successful');
        }
    }catch(error){
        res.status(503).send("Error 503: Service (Database) unavailable. Error: " + error)
    }
});


app.listen(PORT, async () => {

    await db.init();
    console.log('Server is running on http://localhost:' + PORT);
});
