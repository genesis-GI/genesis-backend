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

    const hash = await bcrypt.hash(password, 10);
    try{
        const collection = db.collection("accounts")
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
                wave: 5,
                created_at: new Date(),
                ownsGame: false
            })
                .then(() => console.log('[dbInteraction.js]: User registered successfully'))
                .catch(err => console.error('[dbInteraction.js]: Error inserting user:', err));
        }
        
        return true;
    }catch(error){
        console.warn("[dbInteraction.js]: Error during register sequence");
        return false;
    }

}

async function login(email, password){
    const collection = db.collection("accounts")
    const user = await collection.findOne({
        email: email
    })
    const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch){
        return false;
    }else{
        return true;
    }
}
async function getUserByEmail(email) {
    try {
        const collection = db.collection('accounts'); // Directly get the collection
        return await collection.findOne({ email });
    } catch (error) {
        console.error('[dbInteraction.js]: Error fetching user by email:', error);
        throw error;
    }
}



module.exports = { register, login, init, reachable, getUserByEmail};