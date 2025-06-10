const express = require('express');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const userManager = require('./userManager');

// Load environment variables before referencing them
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn('Warning: .env file not found or invalid');
} else {
  console.log('Environment variables loaded from .env');
}

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://tacmap.xyz';
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;

const RATE_LIMITS = {
    draw: 200, // ms between draw events
    ping: 1000, // ms between ping events
    placeObject: 200, // ms between object placements
};

const lastEvent = new Map(); // socket.id -> {eventType: timestamp}

// Store active rooms and their states
const rooms = new Map(); // code -> {drawings, pings, objects, currentMap, history, redo}

function createRoomState() {
    return { drawings: [], pings: [], objects: [], currentMap: 'train', history: [], redo: [] };
}

function generateRoomCode() {
    let code;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (rooms.has(code));
    return code;
}

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

function saveState(s) {
    // Persist a single room state to disk if desired in future
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(s));
    } catch (err) {
        console.error('Failed to save state file:', err);
    }
}

function refreshState() {
    const data = loadState();
    return { ...data };
}

function clearBoard(s) {
    s.drawings = [];
    s.pings = [];
    s.objects = [];
}

function pushLimited(arr, item) {
    arr.push(item);
    if (arr.length > MAX_ITEMS) {
        arr.shift();
    }
}

const MAX_HISTORY = 100;

function recordAction(state, action) {
    if (!state.history) state.history = [];
    if (!state.redo) state.redo = [];
    state.history.push(action);
    if (state.history.length > MAX_HISTORY) state.history.shift();
    state.redo = [];
}

function emitUserList(room) {
    const users = userManager.getAllUsers()
        .filter(u => u.room === room)
        .map(u => ({ id: u.id, name: u.name, color: u.color }));
    io.to(room).emit('userList', users);
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
    return data && typeof data.symbol === 'string' && data.symbol.length <= 50 &&
        typeof data.x === 'number' && typeof data.y === 'number' &&
        (!data.type || data.type === 'symbol' || data.type === 'text');
}

function isValidEdit(data) {
    return data && typeof data.index === 'number' &&
        typeof data.symbol === 'string' && data.symbol.length <= 50 &&
        (!data.type || data.type === 'text' || data.type === 'symbol');
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
app.use(express.json());

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


// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve the landing page at the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/landing.html'));
});

// Endpoint to create a new room
app.post('/host', (req, res) => {
    const code = generateRoomCode();
    rooms.set(code, createRoomState());
    res.json({ code });
});

// Serve board page directly if requested
app.get('/board.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/board.html'));
});

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    const roomCode = socket.handshake.query.room;
    const userName = socket.handshake.query.username || '';
    if (!roomCode || !rooms.has(roomCode)) {
        socket.emit('invalidRoom');
        return socket.disconnect(true);
    }

    socket.join(roomCode);
    const roomState = rooms.get(roomCode);

    // Add the user and assign a color
    const user = userManager.addUser(socket.id, userName, roomCode);
    socket.emit('colorAssigned', user.color);
    emitUserList(roomCode);
    socket.broadcast.to(roomCode).emit('userConnected', { id: socket.id, name: userName });

    // Handle color change requests
    socket.on('changeColor', (newColor) => {
        const result = userManager.changeUserColor(socket.id, newColor);

        if (result.success) {
            socket.emit('colorAssigned', result.color);
            emitUserList(roomCode);
            socket.broadcast.to(roomCode).emit('colorChanged', {
                userId: socket.id,
                color: result.color,
            });
        } else {
            socket.emit('colorUnavailable', newColor);
        }
    });

    // Send the current state to the new client
    socket.emit('stateUpdate', roomState);

    // Handle drawing events
    socket.on('draw', (data) => {
        if (!isValidDraw(data) || rateLimited(socket.id, 'draw')) return;
        pushLimited(roomState.drawings, data);
        recordAction(roomState, { type: 'draw', data });
        socket.to(roomCode).emit('draw', data);
    });

    // Handle ping events
    socket.on('ping', (data) => {
        if (!isValidPing(data) || rateLimited(socket.id, 'ping')) return;
        pushLimited(roomState.pings, data);
        socket.to(roomCode).emit('ping', data);
    });

    // Handle object placement events
    socket.on('placeObject', (data) => {
        if (!isValidObject(data) || rateLimited(socket.id, 'placeObject')) return;
        pushLimited(roomState.objects, data);
        recordAction(roomState, { type: 'placeObject', data });
        socket.to(roomCode).emit('placeObject', data);
    });

    // Handle object text edits
    socket.on('editObject', (data) => {
        if (!isValidEdit(data)) return;
        if (roomState.objects[data.index]) {
            roomState.objects[data.index].symbol = data.symbol;
            roomState.objects[data.index].type = data.type || roomState.objects[data.index].type;
            socket.to(roomCode).emit('editObject', data);
        }
    });

    // Handle object movement events
    socket.on('moveObjects', (updates) => {
        if (!isValidMoveList(updates)) return;
        updates.forEach(u => {
            if (roomState.objects[u.index]) {
                roomState.objects[u.index].x = u.x;
                roomState.objects[u.index].y = u.y;
            }
        });
        socket.to(roomCode).emit('moveObjects', updates);
    });

    // Handle object removal events
    socket.on('removeObjects', (indices) => {
        if (!isValidRemoveList(indices)) return;
        const toRemove = [...indices].sort((a, b) => b - a);
        const removed = [];
        toRemove.forEach(i => {
            if (i >= 0 && i < roomState.objects.length) {
                removed.push({ index: i, object: roomState.objects[i] });
                roomState.objects.splice(i, 1);
            }
        });
        if (removed.length > 0) recordAction(roomState, { type: 'removeObjects', removed });
        socket.to(roomCode).emit('removeObjects', toRemove);
    });

    // Handle map change events
    socket.on('changeMap', (mapName) => {
        roomState.currentMap = mapName;
        roomState.drawings = [];
        roomState.pings = [];
        roomState.objects = [];
        io.to(roomCode).emit('mapChanged', mapName);
    });

    // Handle map clear events
    socket.on('clearMap', () => {
        recordAction(roomState, {
            type: 'clearMap',
            prev: {
                drawings: [...roomState.drawings],
                pings: [...roomState.pings],
                objects: [...roomState.objects]
            }
        });
        clearBoard(roomState);
        io.to(roomCode).emit('mapCleared');
        io.to(roomCode).emit('stateUpdate', roomState);
    });

    socket.on('undo', () => {
        const action = roomState.history.pop();
        if (!action) return;
        roomState.redo.push(action);
        switch (action.type) {
            case 'draw':
                if (roomState.drawings.length > 0) roomState.drawings.pop();
                break;
            case 'placeObject':
                if (roomState.objects.length > 0) roomState.objects.pop();
                break;
            case 'removeObjects':
                action.removed.slice().sort((a,b) => a.index - b.index).forEach(({ index, object }) => {
                    roomState.objects.splice(index, 0, object);
                });
                break;
            case 'clearMap':
                roomState.drawings = action.prev.drawings;
                roomState.pings = action.prev.pings;
                roomState.objects = action.prev.objects;
                break;
            default:
                break;
        }
        io.to(roomCode).emit('stateUpdate', roomState);
    });

    socket.on('redo', () => {
        const action = roomState.redo.pop();
        if (!action) return;
        roomState.history.push(action);
        switch (action.type) {
            case 'draw':
                pushLimited(roomState.drawings, action.data);
                break;
            case 'placeObject':
                pushLimited(roomState.objects, action.data);
                break;
            case 'removeObjects':
                action.removed.map(r => r.index).sort((a,b) => b - a).forEach(i => {
                    if (i >= 0 && i < roomState.objects.length) {
                        roomState.objects.splice(i, 1);
                    }
                });
                break;
            case 'clearMap':
                clearBoard(roomState);
                break;
            default:
                break;
        }
        io.to(roomCode).emit('stateUpdate', roomState);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        const removed = userManager.removeUser(socket.id);
        const name = removed ? removed.name : '';
        socket.broadcast.to(roomCode).emit('userDisconnected', { id: socket.id, name });
        emitUserList(roomCode);
        lastEvent.delete(socket.id);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    const protocol = (SSL_KEY_PATH && SSL_CERT_PATH) ? 'https' : 'http';
    console.log(`Server is running on port ${PORT} using ${protocol}`);
});

console.log('Serving static files from:', path.join(__dirname, '../public'));
