import http from "http";
const PORT = Number(process.env.PORT || 8000);
const NAME = process.env.SERVICE_NAME || "hello";
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", name: NAME, pid: process.pid }));
    return;
  }
  res.writeHead(404); res.end();
});
server.listen(PORT, () => console.log(`${NAME} up on ${PORT}`));
