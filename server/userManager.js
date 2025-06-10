const users = [];
// Colors are tracked per room so users in different rooms can reuse the same
// colour selections. Structure: { [roomCode]: { [color]: socketId } }
const colorsInUse = {};

function addUser(socketId, name = '', room) {
    const user = { id: socketId, color: '#ff0000', name, room };
    users.push(user);
    return user;
}

function removeUser(socketId) {
    const userIndex = users.findIndex(u => u.id === socketId);
    if (userIndex !== -1) {
        const user = users[userIndex];
        if (user.color !== '#ff0000' && user.room && colorsInUse[user.room]) {
            delete colorsInUse[user.room][user.color];
        }
        users.splice(userIndex, 1);
        return user;
    }
    return null;
}

function changeUserColor(socketId, newColor) {
    const user = users.find(u => u.id === socketId);

    if (!user) return { success: false, reason: 'User not found' };

    // Normalize color string
    const desired = typeof newColor === 'string' ? newColor.toLowerCase() : newColor;

    const room = user.room;
    if (!colorsInUse[room]) {
        colorsInUse[room] = {};
    }
    const roomColors = colorsInUse[room];

    // If the user is requesting the color they already have, allow it
    if (desired === user.color) {
        return { success: true, color: desired };
    }

    if (desired === '#ff0000' || !roomColors[desired]) {
        // Free the user's current color if it's not #ff0000
        if (user.color !== '#ff0000') {
            delete roomColors[user.color];
        }

        // Assign the new color
        user.color = desired;
        if (desired !== '#ff0000') {
            roomColors[desired] = socketId;
        }

        return { success: true, color: desired };
    }

    return { success: false, reason: 'Color unavailable' };
}

function setUserName(socketId, name) {
    const user = users.find(u => u.id === socketId);
    if (user) {
        user.name = name;
        return true;
    }
    return false;
}

function getUser(socketId) {
    return users.find(u => u.id === socketId) || null;
}

function getAllUsers() {
    return users;
}

module.exports = {
    addUser,
    removeUser,
    changeUserColor,
    setUserName,
    getUser,
    getAllUsers,
};
