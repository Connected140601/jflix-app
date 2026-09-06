const http = require('http');
const fs = require('fs');
const path = require('path');

// Get port from command line arguments or use 8080 as default
const PORT = process.env.PORT || 8080;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf'
};

// Add templates directory to MIME_TYPES
MIME_TYPES['.template'] = 'text/html';

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Parse the URL to handle query parameters
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  
  // Handle root path and strip query parameters
  let pathname = parsedUrl.pathname;
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);
  
  const extname = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.log(`File not found: ${filePath}`);
        res.writeHead(404);
        res.end('404 - File Not Found');
      } else {
        console.error(`Server error: ${err.code}`);
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      console.log(`Serving: ${filePath} as ${contentType}`);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${server.address().port}/`);
  console.log(`Press Ctrl+C to stop the server`);
});
