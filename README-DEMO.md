# CogTechAI — Demo Quickstart (Prod HTTPS)

This guide brings up the demo stack on **https://demo.yourdomain.com** with Let’s Encrypt TLS.

---

## 1) Prerequisites
- DNS: `demo.yourdomain.com` → your server public IP (A record)
- Open ports: **80/443** on your server / cloud firewall
- Docker Desktop / Engine running

---

## 2) Bring up the stack (prod overlay)
```powershell
cd D:\CT2\compose
docker compose `
  -f docker-compose.demo.yml `
  -f docker-compose.demo.override.yml `
  -f docker-compose.demo.override.db.yml `
  -f docker-compose.demo.prod.yml `
  up -d --build
