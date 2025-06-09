const http = require('http');
const { exec } = require('child_process');

const SECRET_PATH = '/github-webhook'; // You can customize this path

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === SECRET_PATH) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('GitHub webhook received. Running deploy.sh...');
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
  } else {
    res.writeHead(404).end('Not found');
  }
});

server.listen(4000, () => {
  console.log('Webhook listener running on port 4000');
});
