-- Missed in the earlier Event->Project rename migration: CustomRole's own
-- "events" access-tier column.
ALTER TABLE "CustomRole" RENAME COLUMN "events" TO "projects";
