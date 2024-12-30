const db = require('./dbInteraction');

function formatTime(seconds) {
    if (seconds < 60) {
        return 'a few seconds ago';
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes == 1) {
        return `${minutes} minute ago`;
    } else if (minutes < 60) {
        return `${minutes} minutes ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours == 1) {
        return `${hours} hour ago`;
    } else if (hours < 24) {
        return `${hours} hours ago`;
    }

    const days = Math.floor(hours / 24);
    if (days == 1) {
        return `${days} day ago`;
    } else if (days < 7) {
        return `${days} days ago`;
    }

    const weeks = Math.floor(days / 7);
    if (weeks == 1) {
        return `${weeks} week ago`;
    } else if (weeks < 4) {
        return `${weeks} weeks ago`;
    }

    const months = Math.floor(days / 30);
    if (months == 1) {
        return `${months} month ago`;
    } else if (months < 12) {
        return `${months} months ago`;
    }

    const years = Math.floor(days / 365);
    if (years == 1) {
        return `${years} year ago`;
    } else {
        return `${years} years ago`;
    }
}

function listenForMOTDUpdates(channel, callback) {
    const motdRef = db.getMOTDRef(channel);
    motdRef.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            const motdInfos = {
                message: data.message,
                date: {
                    _seconds: data.date.seconds,
                    _nanoseconds: data.date.nanoseconds
                }
            };
            callback(motdInfos);
        }
    });
}

function listenForChannelUpdates(callback) {
    db.getFirestore().listCollections().then(collections => {
        const channels = collections
            .filter(collection => collection.id.startsWith('spectrum-'))
            .map(collection => collection.id.replace('spectrum-', ''));
        callback(channels);
    }).catch(error => {
        console.error('Error fetching channels:', error);
    });
}

function listenForStarredChannelUpdates(email, callback) {
    const userRef = db.getUserRefByEmail(email);
    userRef.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            callback(data.starredChannels || []);
        }
    });
}

async function getMOTD(channel){
    let motdInfos = await db.getMOTD(channel);
    if (motdInfos && motdInfos.date) {
        motdInfos.lastChanged = formatTime((Date.now() - motdInfos.date.toDate().getTime()) / 1000);
    } else {
        motdInfos = {
            message: "No message of the day available.",
            lastChanged: "N/A"
        };
    }
    return motdInfos;
}

async function setMOTD(message, channel){
    await db.setMOTD(message, channel)
}

async function getUsers() {
    return await db.getUsers();
}

async function getChannel(channel) {
    return await db.getChannel(channel);
}

async function createChannel(channel) {
    return await db.createChannel(channel);
}

async function deleteChannel(channel) {
    return await db.deleteChannel(channel);
}

async function getChannels() {
    return await db.getChannels();
}

async function starChannel(email, channel, isStarred) {
    await db.starChannel(email, channel, isStarred);
}

async function getStarredChannels(email) {
    return await db.getStarredChannels(email);
}

function removeMOTDListener(channel, callback) {
    const motdRef = db.getMOTDRef(channel);
    motdRef.onSnapshot(() => {}).off(callback);
}

function removeChannelListener(callback) {
    db.getFirestore().listCollections().then(collections => {
        const channels = collections
            .filter(collection => collection.id.startsWith('spectrum-'))
            .map(collection => collection.id.replace('spectrum-', ''));
        callback(channels);
    }).catch(error => {
        console.error('Error fetching channels:', error);
    }).off(callback);
}

function removeStarredChannelListener(email, callback) {
    const userRef = db.getUserRefByEmail(email);
    userRef.onSnapshot(() => {}).off(callback);
}

module.exports = { 
    setMOTD, getMOTD, getUsers, getChannel, createChannel, deleteChannel, getChannels, 
    starChannel, getStarredChannels, listenForMOTDUpdates, listenForChannelUpdates, 
    listenForStarredChannelUpdates, removeMOTDListener, removeChannelListener, removeStarredChannelListener 
};