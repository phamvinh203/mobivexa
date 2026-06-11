import "./config/env";

import express from "express";
import cors from "cors";
import http from "http";
import { connectDB } from "./config/db";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function bootstrap() {
  await connectDB();

  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });

  server.on("error", (err) => {
    console.error("[Server] Error:", err);
    process.exit(1);
  });
}

bootstrap();
