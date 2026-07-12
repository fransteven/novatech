import { db } from "@/db";
import { auditLogs } from "@/db/schema";

type FieldChange = { old: unknown; new: unknown };

interface RecordAuditInput {
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, FieldChange>;
}

export const recordAudit = async ({
  userId,
  userName,
  action,
  entityType,
  entityId,
  changes,
}: RecordAuditInput) => {
  await db.insert(auditLogs).values({
    userId,
    userName,
    action,
    entityType,
    entityId,
    changes,
  });
};
