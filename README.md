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
│   │   └── script.js       # Client-side JavaScript logic
│   ├── maps                # Map assets for the application
│   ├── index.html          # Main HTML structure
├── server                  # Server-side logic
│   ├── app.js              # Entry point for the server-side
│   ├── sockets.js          # Manages WebSocket connections for 
│   ├── userManager.js      # Handles user management and color 
├── index.html              # Main entry point for the application
├── package.json            # npm configuration file
├── README.md               # Project documentation
```

## Features
- **Map Selection**: Choose from various maps to work on.
- **Drawing Tools**: Use different tools to draw, ping, and interact with the map.
- **Real-Time Collaboration**: See the actions of other users in real-time, including dropped objects and drawings.
- **Color Picker**: Select colors for drawing and marking on the map.
- **User Management**: Assign unique colors to users and manage their interactions.

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
4. Start the server:
   ```
   npm start
   ```
5. Open your browser and navigate to `http://localhost:3000` to access the application.

## Usage
- Select a map from the dropdown menu.
- Use the tools provided to draw or drop objects on the map.
- Interact with other users' actions in real-time.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.