const http = require('http');
const { exec } = require('child_process');

const SECRET_PATH = '/github-webhook'; // Customize if desired
const DEPLOY_REF = process.env.DEPLOY_REF || 'refs/heads/main';

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== SECRET_PATH) {
    res.writeHead(404).end('Not found');
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const event = req.headers['x-github-event'];

    if (event !== 'push') {
      console.log(`Ignoring event ${event}`);
      res.writeHead(200).end('Event ignored');
      return;
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (err) {
      console.error('Invalid JSON payload:', err);
      res.writeHead(400).end('Bad payload');
      return;
    }

    if (payload.ref !== DEPLOY_REF || payload.deleted) {
      console.log(`Ignoring push to ${payload.ref}`);
      res.writeHead(200).end('Push ignored');
      return;
    }

    console.log('Merge push received. Running deploy.sh...');
    exec('/home/opc/deploy.sh', (err, stdout, stderr) => {
      if (err) {
        console.error(`Error: ${err.message}`);
        res.writeHead(500).end('Deploy failed');
        return;
      }
      console.log(stdout);
      console.error(stderr);
      res.writeHead(200).end('Deploy triggered');
    });
  });
});

server.listen(4000, () => {
  console.log('Webhook listener running on port 4000');
});
