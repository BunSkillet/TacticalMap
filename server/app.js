const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const userManager = require('./userManager');

const STATE_FILE = path.join(__dirname, 'state.json');
const MAX_ITEMS = 1000;

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            return {
                drawings: data.drawings || [],
                pings: data.pings || [],
                objects: data.objects || [],
                currentMap: data.currentMap || 'train'
            };
        } catch (err) {
            console.error('Failed to load state file:', err);
        }
    }
    return {
        drawings: [],
        pings: [],
        objects: [],
        currentMap: 'train'
    };
}

function saveState() {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state));
    } catch (err) {
        console.error('Failed to save state file:', err);
    }
}

function pushLimited(arr, item) {
    arr.push(item);
    if (arr.length > MAX_ITEMS) {
        arr.shift();
    }
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Load existing state from disk or start with defaults
const state = loadState();
saveState();

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
        pushLimited(state.drawings, data);
        io.emit('draw', data); // Broadcast to all clients
        saveState();
    });

    // Handle ping events
    socket.on('ping', (data) => {
        pushLimited(state.pings, data);
        io.emit('ping', data); // Broadcast to all clients
        saveState();
    });

    // Handle object placement events
    socket.on('placeObject', (data) => {
        pushLimited(state.objects, data);
        io.emit('placeObject', data); // Broadcast to all clients
        saveState();
    });

    // Handle map change events
    socket.on('changeMap', (mapName) => {
        state.currentMap = mapName;
        state.drawings = [];
        state.pings = [];
        state.objects = [];
        io.emit('mapChanged', mapName); // Broadcast to all clients
        saveState();
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
