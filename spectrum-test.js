const { set } = require('mongoose');
const db = require('./dbInteraction');

function formatTime(seconds) {
    if (seconds < 60) {
        return 'a few seconds ago';
    }
    const minutes = Math.floor(seconds / 60);
    if(minutes == 1){
        return `${minutes} minute ago`;
    }else if (minutes < 60) {
        return `${minutes} minutes ago`;
    }

    const hours = Math.floor(minutes / 60);
    if(hours == 1){
        return `${hours} hour ago`;
    }else if (hours < 24) {
        return `${hours} hours ago`;
    }

    const days = Math.floor(hours / 24);
    if(days == 1){
        return `${days} day ago`;
    }else if (days < 7) {
        return `${days} days ago`;
    }

    const weeks = Math.floor(days / 7);
    if(weeks == 1){
        return `${weeks} week ago`;
    }if (weeks < 4) {
        return `${weeks} weeks ago`;
    }

    const months = Math.floor(days / 30);
    if (months < 12) {
        return `${months} months ago`;
    }

    const years = Math.floor(days / 365);
    if(years == 1){
        return `${years} year ago`;
    }else {
        return `${years} years ago`;
    }
}

async function getMOTD(){
    setTimeout(async () => {
        motdInfos = await db.getMOTD();
        await console.log('\nMOTD: ', motdInfos.message, '\n')
        await console.log('\nDate: ', motdInfos.date, '\n')
        const timeSinceLastUpdate = (Date.now() - motdInfos.date.toDate().getTime()) / 1000;
        await console.log('Time since last update:', formatTime(timeSinceLastUpdate), '\n')
    }, 800);   
}

async function setMOTD(){
    await db.setMOTD("(Thursday) We are currently cooking up some new features for you! Stay tuned! :)")
        .then(() => {
            console.log('MOTD updated successfully');
        }); 
}

//setMOTD();
getMOTD();
