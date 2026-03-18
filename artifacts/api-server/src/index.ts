import app from "./app";
import { seed } from "./lib/seed";
import { seedGoKart } from "./lib/gokart-seed";
import { CommunicationService } from "./modules/communications/service";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
const communicationService = new CommunicationService("api-process");

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  try {
    await seed();
  } catch (e) {
    console.error("[seed] Failed:", e);
  }
  try {
    await seedGoKart();
  } catch (e) {
    console.error("[gokart-seed] Failed:", e);
  }

  const workerEnabled = process.env["COMM_WORKER_ENABLED"] !== "false";
  const workerIntervalMsRaw = Number(process.env["COMM_WORKER_INTERVAL_MS"] ?? 15000);
  const workerIntervalMs = Number.isFinite(workerIntervalMsRaw) && workerIntervalMsRaw >= 1000 ? workerIntervalMsRaw : 15000;

  if (workerEnabled) {
    setInterval(async () => {
      try {
        const result = await communicationService.processOutboxBatch(20);
        if (result.processed > 0) {
          console.log("[communications.worker] processed", result.processed, "messages");
        }
      } catch (error) {
        console.error("[communications.worker] failed:", error);
      }
    }, workerIntervalMs);
  }
});
