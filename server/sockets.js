const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const userManager = require('./userManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Handle new connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

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

    // Handle object drop event
    socket.on('dropObject', (data) => {
        io.emit('objectDropped', data); // Broadcast to all clients
    });

    // Handle drawing event
    socket.on('draw', (data) => {
        console.log('Draw event received:', data);
        io.emit('draw', data); // Broadcast to all clients
    });

    // Handle ping event
    socket.on('ping', (data) => {
        io.emit('pingReceived', data); // Broadcast to all clients
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