import { startNotificationWorker } from "@/server/notifications/queue";

export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    await startNotificationWorker();
  }
}
