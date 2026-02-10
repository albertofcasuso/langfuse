-- DropIndex
DROP INDEX "public"."conversations_user_id_started_at_idx";

-- CreateIndex
CREATE INDEX "conversations_user_id_project_id_started_at_idx" ON "conversations"("user_id", "project_id", "started_at" DESC);
