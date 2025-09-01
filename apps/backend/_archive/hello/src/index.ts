import http from 'http';
const port = Number(process.env.PORT || 8000);
const server = http.createServer((req,res) => {
  if (req.url === '/health') { res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify({status:'ok'})); return; }
  res.writeHead(404); res.end();
});
server.listen(port, () => console.log('hello up on '+port));
