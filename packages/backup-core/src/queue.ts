import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const backupQueue = new Queue("backup", {
  connection: {
    url: redisUrl,
  },
});

export async function addBackupJob(runId: string, sourceId: string, extraData?: Record<string, any>) {
  await backupQueue.add("run-backup", { runId, sourceId, ...extraData }, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: false,
  });
}

