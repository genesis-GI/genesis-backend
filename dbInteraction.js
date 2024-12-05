const mongoose = require('mongoose');
const bcrypt = require('bcrypt');


let reachable = true;
let db;
async function init() {
    try {
        await mongoose.connect('mongodb://localhost:27017/genesis', {
            serverSelectionTimeoutMS: 2000,
            connectTimeoutMS: 2000, 
        });
    } catch (error) {
        console.warn("Error during database initialization phase.\nDatabase is not available");
        return;  
    }


    db = mongoose.connection;
    db.on('error', (err) => {
        console.error('MongoDB connection error:', err);

    });

    db.once('open', () => {
        console.warn('Connected to the database.');

    });

    db.on('disconnected', () => {
        console.warn('Database disconnected');

    });

    db.on('reconnected', () => {
        console.warn('Database reconnected');
    });
}



async function register(username, email, password) {
    const collection = db.collection("accounts")
    const salt = 10;
    const hash = await bcrypt.hash(password, 10);

    if (!email.includes("@") || !email.includes(".")) {
        console.log("Invalid email format");
        return false;
    }
    const userExists = await collection.findOne({
        username: username
    })
    const emailExists = await collection.findOne({
        email: email
    })
    if(userExists || emailExists){
        console.log("User already registered");
        return false;
    }else{
        collection.insertOne({ 
            username: username, 
            email: email, 
            password: hash,
            admin: false,
            created_at: new Date(),
            ownsGame: false
        })
            .then(() => console.log('User registered successfully'))
            .catch(err => console.error('Error inserting user:', err));
    }
    
    return true;
}

async function login(email, password){
    const collection = db.collection("accounts")
    const user = await collection.findOne({
        email: email
    })
    const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch){
        return false;
    }
    return true;
}



module.exports = { register, login, init, reachable};