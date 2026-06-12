import "./config/env";

import express from "express";
import cors from "cors";
import http from "http";
import { connectDB } from "./config/db";
import { mountRoutes } from "./routes/index.route";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

const CLIENT_URL = process.env.CLIENT_URL
if (!CLIENT_URL || CLIENT_URL === '*') {
  throw new Error('CLIENT_URL phải được đặt và không được là wildcard (*)')
}

app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json());

mountRoutes(app);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Error middleware — đặt sau cùng, sau khi mount routes
app.use(errorHandler);

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
