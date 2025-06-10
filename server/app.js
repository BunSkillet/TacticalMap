const express = require('express');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const userManager = require('./userManager');
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://140.238.196.102:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;

const RATE_LIMITS = {
    draw: 200, // ms between draw events
    ping: 1000, // ms between ping events
    placeObject: 200, // ms between object placements
};

const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn('Warning: .env file not found or invalid');
} else {
  console.log('Environment variables loaded from .env');
}

const lastEvent = new Map(); // socket.id -> {eventType: timestamp}

const STATE_FILE = path.join(__dirname, '../server/state.json');
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

function refreshState() {
    const data = loadState();
    state.drawings = data.drawings;
    state.pings = data.pings;
    state.objects = data.objects;
    state.currentMap = data.currentMap;
}

function clearBoard() {
    state.drawings = [];
    state.pings = [];
    state.objects = [];
}

function pushLimited(arr, item) {
    arr.push(item);
    if (arr.length > MAX_ITEMS) {
        arr.shift();
    }
}

function isValidDraw(data) {
    return data && Array.isArray(data.path) && data.path.length > 0 &&
        data.path.every(pt => typeof pt.x === 'number' && typeof pt.y === 'number') &&
        typeof data.color === 'string' && data.color.length < 20;
}

function isValidPing(data) {
    return data && typeof data.x === 'number' && typeof data.y === 'number' &&
        typeof data.start === 'number';
}

function isValidObject(data) {
    return data && typeof data.symbol === 'string' && data.symbol.length <= 2 &&
        typeof data.x === 'number' && typeof data.y === 'number';
}

function isValidMoveList(arr) {
    return Array.isArray(arr) && arr.every(u =>
        typeof u.index === 'number' &&
        typeof u.x === 'number' &&
        typeof u.y === 'number');
}

function isValidRemoveList(arr) {
    return Array.isArray(arr) && arr.every(i => typeof i === 'number');
}

function rateLimited(socketId, type) {
    const now = Date.now();
    if (!lastEvent.has(socketId)) {
        lastEvent.set(socketId, {});
    }
    const entry = lastEvent.get(socketId);
    const limit = RATE_LIMITS[type] || 0;
    if (entry[type] && now - entry[type] < limit) {
        return true;
    }
    entry[type] = now;
    return false;
}

const app = express();
app.use(helmet({ hsts: false }));
app.use(cors({ origin: allowedOrigin }));

let server;
if (SSL_KEY_PATH && SSL_CERT_PATH) {
    const sslOptions = {
        key: fs.readFileSync(SSL_KEY_PATH),
        cert: fs.readFileSync(SSL_CERT_PATH)
    };
    server = https.createServer(sslOptions, app);
} else {
    server = http.createServer(app);
}

const io = socketIo(server, { cors: { origin: allowedOrigin } });

io.use((socket, next) => {
    if (!AUTH_TOKEN) return next();
    const token = socket.handshake.auth.token;
    if (token === AUTH_TOKEN) return next();
    return next(new Error('Unauthorized'));
});

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
    refreshState();
    socket.emit('stateUpdate', state);

    // Handle drawing events
    socket.on('draw', (data) => {
        if (!isValidDraw(data) || rateLimited(socket.id, 'draw')) return;
        pushLimited(state.drawings, data);
        io.emit('draw', data); // Broadcast to all clients
        saveState();
    });

    // Handle ping events
    socket.on('ping', (data) => {
        if (!isValidPing(data) || rateLimited(socket.id, 'ping')) return;
        pushLimited(state.pings, data);
        io.emit('ping', data); // Broadcast to all clients
        saveState();
    });

    // Handle object placement events
    socket.on('placeObject', (data) => {
        if (!isValidObject(data) || rateLimited(socket.id, 'placeObject')) return;
        pushLimited(state.objects, data);
        io.emit('placeObject', data); // Broadcast to all clients
        saveState();
    });

    // Handle object movement events
    socket.on('moveObjects', (updates) => {
        if (!isValidMoveList(updates)) return;
        updates.forEach(u => {
            if (state.objects[u.index]) {
                state.objects[u.index].x = u.x;
                state.objects[u.index].y = u.y;
            }
        });
        io.emit('moveObjects', updates);
        saveState();
    });

    // Handle object removal events
    socket.on('removeObjects', (indices) => {
        if (!isValidRemoveList(indices)) return;
        const toRemove = [...indices].sort((a, b) => b - a);
        toRemove.forEach(i => {
            if (i >= 0 && i < state.objects.length) {
                state.objects.splice(i, 1);
            }
        });
        io.emit('removeObjects', toRemove);
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

    // Handle map clear events
    socket.on('clearMap', () => {
        clearBoard();
        io.emit('mapCleared'); // Broadcast to all clients
        io.emit('stateUpdate', state);
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
    const protocol = (SSL_KEY_PATH && SSL_CERT_PATH) ? 'https' : 'http';
    console.log(`Server is running on port ${PORT} using ${protocol}`);
});

console.log('Serving static files from:', path.join(__dirname, '../public'));
