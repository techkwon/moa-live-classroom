import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  ownerEmail: text("owner_email"),
  status: text("status").notNull().default("live"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("sessions_code_idx").on(table.code)]);

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["quiz", "cloud", "open"] }).notNull(),
  prompt: text("prompt").notNull(),
  options: text("options"),
  position: integer("position").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
}, (table) => [index("activities_session_idx").on(table.sessionId)]);

export const responses = sqliteTable("responses", {
  id: text("id").primaryKey(),
  activityId: text("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  answer: text("answer").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("responses_activity_idx").on(table.activityId),
  uniqueIndex("responses_once_idx").on(table.activityId, table.participantId),
]);
