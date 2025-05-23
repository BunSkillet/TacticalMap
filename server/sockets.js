const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const userManager = require('./userManager');
const WebSocketServer = require('ws').Server;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const ws = new WebSocketServer({ port: 8080 });

let idUtilisateur = 0; // Counter for unique user IDs

// Simplified WebSocket broadcast function
ws.broadcast = function (data) {
    this.clients.forEach(client => {
        if (client.readyState === 1) { // Ensure the client is open
            client.send(data);
        }
    });
};

ws.on('connection', (socket) => {
    idUtilisateur++;
    const data = { type: "id", val: idUtilisateur };
    socket.send(JSON.stringify(data));

    console.log('WebSocket connection of user:', idUtilisateur);

    socket.on('message', (message) => {
        ws.broadcast(message); // Broadcast received messages to all clients
    });
});

// Handle new connections via socket.io
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Assign a unique ID to the connected user
    const userId = ++idUtilisateur;
    socket.emit('userId', userId);

    // Add user and assign default color (red)
    const user = userManager.addUser(socket.id);
    socket.emit('colorAssigned', user.color);

    // Broadcast when a new user connects
    socket.broadcast.emit('userConnected', socket.id);

    // Handle color change request
    socket.on('changeColor', (newColor) => {
        const result = userManager.changeUserColor(socket.id, newColor);

        if (result.success) {
            socket.emit('colorAssigned', result.color);
            socket.broadcast.emit('colorChanged', { userId: socket.id, color: result.color });
        } else {
            socket.emit('colorUnavailable', newColor);
        }
    });

    // Handle drawing event
    socket.on('draw', (data) => {
        const drawingData = { ...data, userId }; // Attach user ID
        console.log('Draw event received:', drawingData);
        io.emit('draw', drawingData); // Broadcast to all clients
        ws.broadcast(JSON.stringify({ type: 'draw', data: drawingData })); // Broadcast via WebSocket
    });

    // Handle ping event
    socket.on('ping', (data) => {
        io.emit('pingReceived', data); // Broadcast to all clients
        ws.broadcast(JSON.stringify({ type: 'ping', data })); // Broadcast via WebSocket
    });

    // Handle object drop event
    socket.on('dropObject', (data) => {
        io.emit('objectDropped', data); // Broadcast to all clients
        ws.broadcast(JSON.stringify({ type: 'dropObject', data })); // Broadcast via WebSocket
    });

    // Handle map change events
    socket.on('changeMap', (mapName) => {
        io.emit('mapChanged', mapName); // Broadcast to all clients
        ws.broadcast(JSON.stringify({ type: 'mapChanged', mapName })); // Broadcast via WebSocket
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Remove the user
        userManager.removeUser(socket.id);

        socket.broadcast.emit('userDisconnected', socket.id);
    });
});

// Export the server for use in app.js
module.exports = { server, io };