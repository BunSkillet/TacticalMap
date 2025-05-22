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

    if (newColor === 'red' || !colorsInUse[newColor]) {
        // Free the user's current color if it's not red
        if (user.color !== 'red') {
            delete colorsInUse[user.color];
        }

        // Assign the new color
        user.color = newColor;
        if (newColor !== 'red') {
            colorsInUse[newColor] = socketId;
        }

        return { success: true, color: newColor };
    }

    return { success: false, reason: 'Color unavailable' };
}

module.exports = {
    addUser,
    removeUser,
    changeUserColor,
};
