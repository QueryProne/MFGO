import app from "./app";
import { seed } from "./lib/seed";
import { seedGoKart } from "./lib/gokart-seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

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
});
