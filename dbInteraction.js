const admin = require('firebase-admin');
const bcrypt = require('bcrypt');


admin.initializeApp({
  credential: admin.credential.cert('./serviceAccountKey.json'),
});

const db = admin.firestore(); 
let reachable = true;

async function init() {
    try {
        console.warn('Connected to Firestore.');
    } catch (error) {
        console.warn('Error during database initialization phase.\nDatabase is not available');
        reachable = false;
        return;
    }
}


async function register(username, email, password) {
    try {
        if (!email.includes('@') || !email.includes('.')) {
            console.log('Invalid email format');
            return false;
        }

        const userRef = db.collection('accounts');
        
        // Check if username or email exists
        const userSnapshot = await userRef.where('username', '==', username).get();
        const emailSnapshot = await userRef.where('email', '==', email).get();

        if (!userSnapshot.empty || !emailSnapshot.empty) {
            console.log('User already registered');
            return false;
        } else {

            const hashedPassword = await bcrypt.hash(password, 10);

            await userRef.add({
                username: username,
                email: email,
                password: hashedPassword,
                admin: false,
                wave: 5,
                created_at: new Date(),
                ownsGame: false,
                
                ingame: {
                    inventory: {},
                    currency: 0
                },
                playerLocation: Vector3(0, 0, 0),
            });
            console.log('[dbInteraction.js]: User registered successfully');
        }

        return true;
    } catch (error) {
        console.warn('[dbInteraction.js]: Error during register sequence');
        return false;
    }
}


async function login(email, password) {
    try {
        const userRef = db.collection('accounts');
        const userSnapshot = await userRef.where('email', '==', email).get();

        if (userSnapshot.empty) {
            console.log('[dbInteraction.js]: User not found');
            return false;
        }

        const user = userSnapshot.docs[0].data();
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (isPasswordValid) {
            console.log('[dbInteraction.js]: Login successful');
            return true;
        } else {
            console.log('[dbInteraction.js]: Invalid password');
            return false;
        }
    } catch (error) {
        console.warn('[dbInteraction.js]: Error during login sequence');
        return false;
    }
}


async function getUserByEmail(email) {
    try {
        const userRef = db.collection('accounts');
        const userSnapshot = await userRef.where('email', '==', email).get();

        if (!userSnapshot.empty) {
            return userSnapshot.docs[0].data();
        } else {
            console.log('[dbInteraction.js]: User not found');
            return null;
        }
    } catch (error) {
        console.error('[dbInteraction.js]: Error fetching user by email:', error);
        throw error;
    }
}

async function setMOTD(message){
    try{
        motdRef = db.collection('motd')
        const motd = motdRef.doc('motd')
        motd.set({
            message: message,
            date: new Date()
        })
    }
    catch(error){
        console.log("[dbInteraction.js] Error while trying to write do DB")
    }
}

async function getMOTD(){
    motdInfos = {
        message: null,
        date: null
    }
    try {
        const motdRef = db.collection('motd').doc('motd');
        const motdDoc = await motdRef.get(); 

        if (motdDoc.exists) { 
            motdInfos.message = motdDoc.data().message;
            motdInfos.date = motdDoc.data().date;
            return motdInfos;
        } else {
            console.log("[dbInteraction.js] MOTD document does not exist");
            return null; 
        }
    } catch (error) {
        console.log("[dbInteraction.js] Error while trying to read message of the day", error);
        return null; 
    }
}

module.exports = { register, login, init, reachable, getUserByEmail, setMOTD, getMOTD };