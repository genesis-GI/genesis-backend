const admin = require('firebase-admin');
const bcrypt = require('bcrypt');

admin.initializeApp({
  credential: admin.credential.cert('./fireBaseInfo.json'),
});

const db = admin.firestore(); 
let reachable = true;

function getFirestore() {
    return admin.firestore();
}

function getMOTDRef(channel) {
    return db.collection(`spectrum-${channel.toLowerCase()}`).doc('motd');
}

function getUserRefByEmail(email) {
    return db.collection('accounts').where('email', '==', email);
}

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
                playerLocation: { x: 0, y: 0, z: 0 },
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

async function setMOTD(message, channel){
    try{
        motdRef = db.collection('spectrum-' + channel.toLowerCase())
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

async function getMOTD(channel) {
    const motdInfos = {
        message: null,
        date: null,
        lastChanged: null
    };
    try {
        const motdRef = db.collection(`spectrum-${channel.toLowerCase()}`).doc('motd');
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

async function getUsers() {
    try {
        const userRef = db.collection('accounts');
        const userSnapshot = await userRef.get();
        const users = {
            staff: [],
            backers: []
        };

        userSnapshot.forEach(doc => {
            const user = doc.data();
            if (user.admin) {
                users.staff.push(user.username);
            } else {
                users.backers.push(user.username);
            }
        });

        return users;
    } catch (error) {
        console.error('[dbInteraction.js]: Error fetching users:', error);
        throw error;
    }
}

async function getChannel(channel) {
    try {
        const channelRef = db.collection(`spectrum-${channel.toLowerCase()}`);
        const channelSnapshot = await channelRef.get();
        return !channelSnapshot.empty;
    } catch (error) {
        console.error('[dbInteraction.js]: Error fetching channel:', error);
        throw error;
    }
}

async function createChannel(channel) {
    try {
        const channelRef = db.collection(`spectrum-${channel.toLowerCase()}`);
        await channelRef.add({
            created_at: new Date()
        });
        console.log(`[dbInteraction.js]: Channel ${channel} created successfully`);
    } catch (error) {
        console.error('[dbInteraction.js]: Error creating channel:', error);
        throw error;
    }
}

async function deleteChannel(channel) {
    try {
        const channelRef = db.collection(`spectrum-${channel.toLowerCase()}`);
        const channelSnapshot = await channelRef.get();

        if (!channelSnapshot.empty) {
            const batch = db.batch();
            channelSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`[dbInteraction.js]: Channel ${channel} deleted successfully`);
        } else {
            console.log(`[dbInteraction.js]: Channel ${channel} does not exist`);
        }
    } catch (error) {
        console.error('[dbInteraction.js]: Error deleting channel:', error);
        throw error;
    }
}

async function getChannels() {
    try {
        const channels = [];
        const collections = await db.listCollections();
        collections.forEach(collection => {
            if (collection.id.startsWith('spectrum-')) {
                channels.push(collection.id.replace('spectrum-', ''));
            }
        });
        return channels;
    } catch (error) {
        console.error('[dbInteraction.js]: Error fetching channels:', error);
        throw error;
    }
}

async function starChannel(email, channel, isStarred) {
    try {
        const userRef = db.collection('accounts').where('email', '==', email);
        const userSnapshot = await userRef.get();
        if (!userSnapshot.empty) {
            const userDoc = userSnapshot.docs[0];
            const userData = userDoc.data();
            const starredChannels = userData.starredChannels || [];
            if (isStarred) {
                if (!starredChannels.includes(channel)) {
                    starredChannels.push(channel);
                }
            } else {
                const index = starredChannels.indexOf(channel);
                if (index > -1) {
                    starredChannels.splice(index, 1);
                }
            }
            await userDoc.ref.update({ starredChannels });
        }
    } catch (error) {
        console.error('[dbInteraction.js]: Error updating starred channels:', error);
        throw error;
    }
}

async function getStarredChannels(email) {
    try {
        const userRef = db.collection('accounts').where('email', '==', email);
        const userSnapshot = await userRef.get();
        if (!userSnapshot.empty) {
            const userDoc = userSnapshot.docs[0];
            const userData = userDoc.data();
            return userData.starredChannels || [];
        } else {
            console.log('[dbInteraction.js]: User not found');
            return [];
        }
    } catch (error) {
        console.error('[dbInteraction.js]: Error fetching starred channels:', error);
        throw error;
    }
}

async function fetchRemoteConfig() {
    try {
        const remoteConfig = admin.remoteConfig();
        // Abrufen der aktuellen Vorlage
        const template = await remoteConfig.getTemplate();
        
        // Alle Parameter in einer JSON-Variable speichern
        const parameters = template.parameters;


        const configJson = {};
        for (const key in parameters) {
            configJson[key] = parameters[key].defaultValue 
                ? parameters[key].defaultValue.value 
                : null;
        }

        return configJson;
    } catch (error) {
        console.error("Fehler beim Abrufen der Remote Config:", error);
        throw error;
    }
}

async function getGameConfig() {
    try {
        const rawData = await fetchRemoteConfig();
        if (!rawData || typeof rawData !== 'object' || !rawData.gameConfig) {
            throw new Error("Invalid remote config data: 'gameConfig' missing");
        }
        return JSON.parse(rawData.gameConfig);
    } catch (error) {
        console.error("[dbInteraction.js]: Error retrieving game config:", error);
        throw error;
    }
}

module.exports = { fetchRemoteConfig, register, login, init, reachable, getUserByEmail, setMOTD, getMOTD, getUsers, getChannel, createChannel, deleteChannel, getChannels, starChannel, getStarredChannels, getMOTDRef, getUserRefByEmail, getFirestore, getGameConfig };