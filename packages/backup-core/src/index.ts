export const backupQueueNames = [
  "backup",
  "upload",
  "cleanup",
  "notification",
  "verification",
] as const;
export type BackupQueueName = (typeof backupQueueNames)[number];

export * from "./ssh";
export * from "./queue";
export * from "./executor";
export * from "./notifications";
export * from "./retention";
