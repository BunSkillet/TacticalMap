const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

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

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log('A user connected');

    // Send the current state to the new client
    socket.emit('stateUpdate', state);

    // Handle drawing events
    socket.on('draw', (data) => {
        state.drawings.push(data);
        io.emit('draw', data);
    });

    // Handle ping events
    socket.on('ping', (data) => {
        state.pings.push(data);
        io.emit('ping', data);
    });

    // Handle object placement events
    socket.on('placeObject', (data) => {
        state.objects.push(data);
        io.emit('placeObject', data);
    });

    // Handle map change events
    socket.on('changeMap', (mapName) => {
        state.currentMap = mapName;
        state.drawings = [];
        state.pings = [];
        state.objects = [];
        io.emit('mapChanged', mapName);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});