ALTER TABLE "users" ADD COLUMN "phone" varchar(20) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_active_idx" ON "users" USING btree ("phone") WHERE "users"."deleted_at" IS NULL;