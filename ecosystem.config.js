module.exports = {
  apps: [
    {
      name: "tactical-map-server",
      script: "server/app.js",
      watch: false,
      env: {
        NODE_ENV: "development",
        PORT: 3000
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
