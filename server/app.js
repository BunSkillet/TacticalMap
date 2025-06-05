const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const userManager = require('./userManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const state = {
    drawings: [],
    pings: [],
    objects: [],
    currentMap: 'train', // Default map
};

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve the main HTML file from the project root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Add the user and assign a color
    const user = userManager.addUser(socket.id);
    socket.emit('colorAssigned', user.color);
    socket.broadcast.emit('userConnected', socket.id);

    // Handle color change requests
    socket.on('changeColor', (newColor) => {
        const result = userManager.changeUserColor(socket.id, newColor);

        if (result.success) {
            socket.emit('colorAssigned', result.color);
            socket.broadcast.emit('colorChanged', { userId: socket.id, color: result.color });
        } else {
            socket.emit('colorUnavailable', newColor);
        }
    });

    // Send the current state to the new client
    socket.emit('stateUpdate', state);

    // Handle drawing events
    socket.on('draw', (data) => {
        state.drawings.push(data);
        io.emit('draw', data); // Broadcast to all clients
    });

    // Handle ping events
    socket.on('ping', (data) => {
        state.pings.push(data);
        io.emit('ping', data); // Broadcast to all clients
    });

    // Handle object placement events
    socket.on('placeObject', (data) => {
        state.objects.push(data);
        io.emit('placeObject', data); // Broadcast to all clients
    });

    // Handle map change events
    socket.on('changeMap', (mapName) => {
        state.currentMap = mapName;
        state.drawings = [];
        state.pings = [];
        state.objects = [];
        io.emit('mapChanged', mapName); // Broadcast to all clients
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        userManager.removeUser(socket.id);
        socket.broadcast.emit('userDisconnected', socket.id);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
