import { createApp } from "./app";

const app = createApp();
const PORT = Number(process.env.PORT ?? 8000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[service] listening on 0.0.0.0:${PORT}`);
});
