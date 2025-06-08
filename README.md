# CS2 Tactical Board

## Overview
The CS2 Tactical Board is a collaborative web application that allows multiple users to interact with a tactical map in real-time. Users can select maps, draw on the canvas, drop objects, and ping locations, all while seeing the actions of other users live.

## Project Structure
```
tacticalMap
├── public                  # Public-facing files
│   ├── css
│   │   └── style.css       # Styles for the application
│   ├── js
│   │   ├── main.js         # Client-side entry point
│   │   ├── canvas.js       # Canvas rendering logic
│   │   ├── events.js       # DOM event handlers
│   │   ├── socketHandlers.js # Socket.io helpers
│   │   └── state.js        # Application state management
│   └── maps                # Map assets for the application
├── server                  # Server-side logic
│   ├── app.js              # Entry point for the server-side
│   └── userManager.js      # Handles user management and color assignments
├── index.html              # Main entry point for the application
├── package.json            # npm configuration file
└── README.md               # Project documentation
```

## Features
- **Map Selection**: Choose from various maps to work on.
- **Drawing Tools**: Use different tools to draw, ping, and interact with the map.
- **Real-Time Collaboration**: See the actions of other users in real-time, including dropped objects and drawings.
- **Color Picker**: Select colors for drawing and marking on the map.
- **User Management**: Assign unique colors to users and manage their interactions.
- **State Persistence**: Server state is saved to disk and old entries are automatically pruned.
- **Request Validation**: Incoming drawing, ping, and object data is validated and rate limited to prevent abuse.
- **Security Hardening**: Optional authentication token, and configurable origin restrictions using environment variables.
- **Automated Tests**: Basic unit tests verify user management functions.

## Setup Instructions
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd tacticalMap
   ```
3. Install the dependencies:
   ```
   npm install
   ```
4. Run the tests:
   ```
   npm test
   ```
5. Start the server:
   ```
   npm start
   ```
6. Open your browser and navigate to `http://localhost:3000` to access the application.

### Environment Variables
The server recognizes several optional environment variables:

- `ALLOWED_ORIGIN` – URL allowed to access the server (default: `http://localhost:3000`).
- `AUTH_TOKEN` – If set, clients must provide this token when connecting via Socket.IO.

To supply a token on the client, store it in `localStorage` under the key `authToken` before loading the page.

## PM2 Setup and Deployment

To manage the server using `pm2`, follow these steps:

### Installation
1. Install `pm2` globally if not already installed:
   ```
   npm install -g pm2
   ```

### Starting the Server
1. Use the provided `ecosystem.config.js` file to start the server:
   ```
   pm2 start ecosystem.config.js
   ```

2. To view the status of the application:
   ```
   pm2 status
   ```

3. To stop the application:
   ```
   pm2 stop ecosystem.config.js
   ```

4. To restart the application:
   ```
   pm2 restart ecosystem.config.js
   ```

5. To view logs:
   ```
   pm2 logs
   ```

### Additional PM2 Commands
- Save the current process list:
  ```
  pm2 save
  ```

- Automatically resurrect processes on server reboot:
  ```
  pm2 startup
  ```

### Accessing the Application
Once the server is running, open your browser and navigate to `http://localhost:3000` to access the application.

## Usage
- Select a map from the dropdown menu.
- Use the tools provided to draw or drop objects on the map.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.
