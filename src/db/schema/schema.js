import { pgTable, uuid, varchar, integer, timestamp, text, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { vector, jsonb } from "drizzle-orm/pg-core";

export const facultyEnum = pgEnum("faculty", ['FIF', 'FRI', 'FTE', 'FIK', 'FIT', 'FKS', 'FEB']);

export const reportTypeEnum = pgEnum("report_type", [
  'Hate',
  'Abuse & Harassment',
  'Violent Speech',
  'Privacy',
  'Spam',
  'Violent & hateful entities',
  'Civic Integrity',
  'Other'
]);

export const reportStatusEnum = pgEnum("report_status", [
  'Pending',
  'Reviewing',
  'Investigating',
  'Action',
  'Resolved',
  'Rejected'
]);


export const users = pgTable("users", {
  id_user: uuid("id_user").defaultRandom().primaryKey().notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  email: varchar("email", { length: 128 }).notNull().unique(),
  image: varchar("image", { length: 255 }),
  poin: integer("poin").default(0),
  refreshToken: text("refresh_token"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const usersRelations = relations(users, ({ many }) => ({
  reviews: many(reviews),
  bookmarkReviews: many(bookmarkReviews),
  reports: many(reports),
  likeReviews: many(likeReviews),
}));

export const lecturers = pgTable("dosen", {
  id_lecturer: uuid("id_lecturer").defaultRandom().primaryKey().notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  npm: varchar("npm", { length: 50 }),
  email: varchar("email", { length: 128 }),
  faculty: facultyEnum("faculty").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const lecturersRelations = relations(lecturers, ({ many }) => ({
  reviews: many(reviews),
  reports: many(reports),
  likeReviews: many(likeReviews),
}));

export const subjects = pgTable("subjects", {
  id_subject: uuid("id_subject").defaultRandom().primaryKey().notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  semester: integer("semester"),
});

export const subjectsRelations = relations(subjects, ({ many }) => ({
  reviews: many(reviews),
  likeReviews: many(likeReviews),
}));

export const reviews = pgTable("reviews", {
  id_review: uuid("id_review").defaultRandom().primaryKey().notNull(),
  id_user: uuid("id_user").notNull().references(() => users.id_user),
  id_subject: uuid("id_subject").references(() => subjects.id_subject, { onDelete: "cascade" }),
  id_lecturer: uuid("id_lecturer").references(() => lecturers.id_lecturer, { onDelete: "cascade" }),
  id_reply: uuid("id_reply").references(() => reviews.id_review, { onDelete: "cascade" }),
  files: jsonb("files").$type/** @type {string[]} */(),
  title: varchar("title", { length: 128 }).notNull(),
  body: text("body"),
  vectorize: vector("vectorize", { dimensions: 1024 }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
  updated_at: timestamp("updated_at", { withTimezone: true }).default(null).$onUpdate(() => new Date()),
});

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  user: one(users, { fields: [reviews.id_user], references: [users.id_user] }),
  lecturer: one(lecturers, { fields: [reviews.id_lecturer], references: [lecturers.id_lecturer] }),
  subject: one(subjects, { fields: [reviews.id_subject], references: [subjects.id_subject] }),
  bookmarkReviews: many(bookmarkReviews),
  likeReviews: many(likeReviews),
  reports: many(reports),
}));

export const bookmarkReviews = pgTable("bookmark_reviews", {
  id_bookmark: uuid("id_bookmark").defaultRandom().primaryKey().notNull(),
  id_user: uuid("id_user").references(() => users.id_user, { onDelete: "cascade" }).notNull(),
  id_review: uuid("id_review").references(() => reviews.id_review, { onDelete: "cascade" }).notNull(),
});

export const bookmarkReviewsRelations = relations(bookmarkReviews, ({ one }) => ({
  users: one(users, { fields: [bookmarkReviews.id_user], references: [users.id_user] }),
  reviews: one(reviews, { fields: [bookmarkReviews.id_review], references: [reviews.id_review] }),
}));

export const likeReviews = pgTable("like_reviews", {
  id_like: uuid("id_like").defaultRandom().primaryKey().notNull(),
  id_user: uuid("id_user").references(() => users.id_user, { onDelete: "cascade" }).notNull(),
  id_review: uuid("id_review").references(() => reviews.id_review, { onDelete: "cascade" }),
});

export const likeReviewsRelations = relations(likeReviews, ({ one }) => ({
  users: one(users, { fields: [likeReviews.id_user], references: [users.id_user] }),
  reviews: one(reviews, { fields: [likeReviews.id_review], references: [reviews.id_review] }),
}));

export const reports = pgTable("reports", {
  id_report: uuid("id_report").defaultRandom().primaryKey().notNull(),
  id_user: uuid("id_user").references(() => users.id_user, { onDelete: "cascade" }).notNull(),
  id_lecturer: uuid("id_lecturer").references(() => lecturers.id_lecturer, { onDelete: "cascade" }),
  id_review: uuid("id_review").references(() => reviews.id_review, { onDelete: "cascade" }),
  type: reportTypeEnum("report_type").notNull(),
  body: text("body"),
  description: text("description"),
  status: reportStatusEnum("report_status").notNull().default("Pending"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const reportRelations = relations(reports, ({ one }) => ({
  users: one(users, { fields: [reports.id_user], references: [users.id_user] }),
  lecturers: one(lecturers, { fields: [reports.id_lecturer], references: [lecturers.id_lecturer] }),
  reviews: one(reviews, { fields: [reports.id_review], references: [reviews.id_review] }),
}));

export const reviewsForum = pgTable("reviews_forum", {
  id_forum: uuid("id_forum").defaultRandom().primaryKey().notNull(),
  id_user: uuid("id_user").references(() => users.id_user, { onDelete: "cascade" }).notNull(),
  id_subject: uuid("id_subject").references(() => subjects.id_subject, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
})

export const chatbotHistory = pgTable("chatbot_history", {
  id_chatbot: uuid("id_chatbot").defaultRandom().primaryKey().notNull(),
  id_user: uuid("id_user").references(() => users.id_user, { onDelete: "cascade" }).notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
})