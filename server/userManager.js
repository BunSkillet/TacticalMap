const users = [];
const colorsInUse = {}; // Tracks which colors are in use (except red)

function addUser(socketId) {
    const user = { id: socketId, color: 'red' };
    users.push(user);
    return user;
}

function removeUser(socketId) {
    const userIndex = users.findIndex(u => u.id === socketId);
    if (userIndex !== -1) {
        const user = users[userIndex];
        if (user.color !== 'red') {
            delete colorsInUse[user.color];
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

    // If the user is requesting the color they already have, allow it
    if (desired === user.color) {
        return { success: true, color: desired };
    }

    if (desired === 'red' || !colorsInUse[desired]) {
        // Free the user's current color if it's not red
        if (user.color !== 'red') {
            delete colorsInUse[user.color];
        }

        // Assign the new color
        user.color = desired;
        if (desired !== 'red') {
            colorsInUse[desired] = socketId;
        }

        return { success: true, color: desired };
    }

    return { success: false, reason: 'Color unavailable' };
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
    getUser,
    getAllUsers,
};
