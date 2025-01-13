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
    const sound = new Audio('/public/notification.mp3'); // Add your sound
    const source = new EventSource(`/spectrum/motd/updates/${channel}`);
    let lastMOTD = null;
    source.onmessage = event => {
        const motd = JSON.parse(event.data);
        if (lastMOTD && motd.message !== lastMOTD.message) {
            sound.play().catch(() => {});
        }
        lastMOTD = motd;
        if (callback) callback(motd);
    };
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

function switchChannel(channelName) {
    window.location.href = `/spectrum/${channelName}`;
}

async function setUserStatus(status) {
    try {
        await fetch("/spectrum/status", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({status})
        });
    } catch (error) {
        console.error("Error updating status:", error);
    }
}

function listenForStatusUpdates() {
    const evtSource = new EventSource("/spectrum/status/updates");
    evtSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        updateUserStatusDisplay(data);
    };
}

function updateUserStatusDisplay(statusData) {
    console.log("Received updated status data:", statusData);
}

let lastActivity = Date.now();
const AWAY_TIMEOUT = 5 * 60 * 1000;

document.addEventListener("click", resetActivity);
document.addEventListener("keydown", resetActivity);

function resetActivity() {
    lastActivity = Date.now();
    const currentStatus = document.getElementById('statusDropdown').value;
    if (currentStatus === "away") {
        setUserStatus("online");
    }
}

setInterval(() => {
    const currentStatus = document.getElementById('statusDropdown').value;
    if (currentStatus === "online" && Date.now() - lastActivity >= AWAY_TIMEOUT) {
        setUserStatus("away");
    }
}, 60000);

function renderUserList(users, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    users.forEach(userStr => {
        const [username, status] = userStr.split("|");
        const div = document.createElement("div");
        div.textContent = username + " (" + (status || "offline") + ")";
        container.appendChild(div);
    });
}

async function autoLogin() {
    try {
        const response = await fetch('/auto-login');
        if (response.ok) {
            const user = await response.json();
            if (user.admin) {
                document.getElementById('editMotdButton').style.display = 'block';
                document.getElementById('createChannelButton').style.display = 'block';
            } else {
                document.getElementById('createChannelButton').style.display = 'none';
            }
            //document.getElementById('statusDropdown').value = user.wantedStatus || "online";
            //await setUserStatus(user.wantedStatus || "online");
            loadChannels(); // Ensure channels are loaded after login
            switchChannel('genesis-testing-chat');
            fetchUsers();
        } else {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Error during auto-login:', error);
        window.location.href = '/login';
    }
}

async function loadChannels() {
    try {
        const response = await fetch('/spectrum/channels');
        if (response.ok) {
            const channels = await response.json();
            console.log('Channels loaded:', channels); // Add logging
            updateChannelsList(channels);
        } else {
            console.error('Failed to load channels:', response.statusText);
        }
    } catch (error) {
        console.error('Error loading channels:', error);
    }

    // Listen for real-time updates
    listenForChannelUpdates();
}

function updateChannelsList(channels) {
    const channelsList = document.getElementById('channels-list');
    if (!channelsList) {
        console.error('Channels list element not found'); // Add logging
        return;
    }
    channelsList.innerHTML = '';
    channels.forEach(channel => {
        const button = document.createElement('button');
        button.id = channel;
        button.innerHTML = `${channel} <span class="star" onclick="starChannel(event, '${channel}')">☆</span>`;
        button.onclick = () => switchChannel(channel);
        channelsList.appendChild(button);
    });
    console.log('Channels list updated:', channels); // Add logging
}

function handleStatusChange() {
    const newStatus = document.getElementById('statusDropdown').value;
    setUserStatus(newStatus);
}

function beepNotification() {
    // Example notification sound
    const audio = new Audio("/public/notification.mp3");
    audio.play();
}

function handleMotdUpdate(newMotd) {
    // ...existing code...
    fetchUserStatus().then(status => {
        if (status !== "dnd") {
            beepNotification();
            showNotification("MOTD changed!", "info");
        }
    });
    // ...existing code...
}

document.getElementById('sendButton').addEventListener('click', async () => {
    const message = document.getElementById('messageInput').value;
    await sendMessage(currentChannel, message);
    document.getElementById('messageInput').value = "";
});

async function sendMessage(channel, message) {
    await fetch(`/spectrum/messages/${channel}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
    });
}

async function loadMessages(channel) {
    const res = await fetch(`/spectrum/messages/${channel}`);
    const messages = await res.json();
    const chatContainer = document.getElementById("chat-messages");
    chatContainer.innerHTML = "";
    messages.forEach(msg => {
        const messageDiv = document.createElement("div");
        const userDiv = document.createElement("div");
        const dateDiv = document.createElement("div");
        const textDiv = document.createElement("div");

        userDiv.textContent = msg.email;
        dateDiv.textContent = new Date(msg.timestamp._seconds * 1000).toLocaleString();
        textDiv.textContent = msg.message;

        messageDiv.appendChild(userDiv);
        messageDiv.appendChild(dateDiv);
        messageDiv.appendChild(textDiv);
        chatContainer.appendChild(messageDiv);
    });
}

function listenForMessageUpdates(channel) {
    const source = new EventSource(`/spectrum/${channel}/messages/updates`);
    source.onmessage = (event) => {
        const messages = JSON.parse(event.data);
        const chatContainer = document.getElementById("chat-messages");
        chatContainer.innerHTML = "";
        messages.forEach(msg => {
            const messageDiv = document.createElement("div");
            const userDiv = document.createElement("div");
            const dateDiv = document.createElement("div");
            const textDiv = document.createElement("div");

            userDiv.textContent = msg.email;
            dateDiv.textContent = new Date(msg.timestamp._seconds * 1000).toLocaleString();
            textDiv.textContent = msg.message;

            messageDiv.appendChild(userDiv);
            messageDiv.appendChild(dateDiv);
            messageDiv.appendChild(textDiv);
            chatContainer.appendChild(messageDiv);
        });
    };
}

document.getElementById('sendMessageBtn').addEventListener('click', async () => {
    const channel = document.getElementById('currentChannelName').innerText;
    const msg = document.getElementById('messageInput').value.trim();
    if (msg) {
        await sendMessage(channel, msg);
        document.getElementById('messageInput').value = "";
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const defaultChannel = "genesis-testing-chat";
    await loadMessages(defaultChannel);
    listenForMessageUpdates(defaultChannel);
    listenForStatusUpdates();
});

module.exports = { setMOTD, getMOTD, getUsers, getChannel, createChannel, deleteChannel, getChannels, starChannel, getStarredChannels, listenForMOTDUpdates, listenForChannelUpdates, listenForStarredChannelUpdates, switchChannel, setUserStatus, listenForStatusUpdates, listenForMessageUpdates };