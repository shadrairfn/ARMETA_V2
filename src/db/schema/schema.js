import { pgTable, uuid, varchar, integer, timestamp, text, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { vector, jsonb } from "drizzle-orm/pg-core";


export const users = pgTable("users", {
  id_user: uuid("id_user").defaultRandom().primaryKey().notNull(),
  nama: varchar("nama", { length: 128 }).notNull(),
  email: varchar("email", { length: 128 }).notNull().unique(),
  image: varchar("image", { length: 255 }),
  poin_reputasi: integer("poin_reputasi").default(0),
  refreshToken: text("refresh_token"),
});

export const usersRelations = relations(users, ({ many }) => ({
  ulasan: many(ulasan),
  bookmarkUlasan: many(bookmarkUlasan),
  report: many(report),
  likeUlasanMatkul: many(likeUlasanMatkul),
}));

export const dosen = pgTable("dosen", {
  id_dosen: uuid("id_dosen").defaultRandom().primaryKey().notNull(),
  nama_dosen: varchar("nama_dosen", { length: 128 }).notNull(),
  npm: varchar("npm", { length: 50 }),
  email: varchar("email", { length: 128 }),
  fakultas: varchar("fakultas", { length: 128 }),
  prodi: varchar("prodi", { length: 128 }),
});

export const dosenRelations = relations(dosen, ({ many }) => ({
  ulasan: many(ulasan),
  report: many(report),
  likeUlasanMatkul: many(likeUlasanMatkul),
}));

export const mataKuliah = pgTable("mata_kuliah", {
  id_matkul: uuid("id_matkul").defaultRandom().primaryKey().notNull(),
  kode_matkul: varchar("kode_matkul", { length: 50 }).notNull(),
  nama_matkul: varchar("nama_matkul", { length: 128 }).notNull(),
  semester: integer("semester"),
});

export const mataKuliahRelations = relations(mataKuliah, ({ many }) => ({
  ulasan: many(ulasan),
  likeUlasanMatkul: many(likeUlasanMatkul),
}));

export const ulasan = pgTable("ulasan", {
  id_ulasan: uuid("id_ulasan").defaultRandom().primaryKey().notNull(),
  id_user: uuid("id_user").notNull().references(() => users.id_user),
  id_matkul: uuid("id_matkul").references(() => mataKuliah.id_matkul, { onDelete: "cascade" }),
  id_dosen: uuid("id_dosen").references(() => dosen.id_dosen, { onDelete: "cascade" }),
  id_ulasan_reply: uuid("id_ulasan_reply").references(() => ulasan.id_ulasan, { onDelete: "cascade" }),
  files: jsonb("files").$type/** @type {string[]} */(),
  judul_ulasan: varchar("judul_ulasan", { length: 128 }).notNull(),
  teks_ulasan: text("teks_ulasan").notNull(),
  vectorize_ulasan: vector("vectorize_ulasan", { dimensions: 1024 }),
  tanggal_upload: timestamp("tanggal_upload").defaultNow(),
});

export const ulasanRelations = relations(ulasan, ({ one, many }) => ({
  user: one(users, { fields: [ulasan.id_user], references: [users.id_user] }),
  dosen: one(dosen, { fields: [ulasan.id_dosen], references: [dosen.id_dosen] }),
  mataKuliah: one(mataKuliah, { fields: [ulasan.id_matkul], references: [mataKuliah.id_matkul] }),
  bookmarkUlasan: many(bookmarkUlasan),
  likeUlasanMatkul: many(likeUlasanMatkul),
  report: many(report),
}));

export const bookmarkUlasan = pgTable("bookmark_ulasan", {
  id_bookmark: uuid("id_bookmark").defaultRandom().primaryKey().notNull(),
  id_user: uuid("id_user").references(() => users.id_user, { onDelete: "cascade" }).notNull(),
  id_ulasan: uuid("id_ulasan").references(() => ulasan.id_ulasan, { onDelete: "cascade" }).notNull(),
});

export const bookmarkUlasanRelations = relations(bookmarkUlasan, ({ one }) => ({
  user: one(users, { fields: [bookmarkUlasan.id_user], references: [users.id_user] }),
  ulasan: one(ulasan, { fields: [bookmarkUlasan.id_ulasan], references: [ulasan.id_ulasan] }),
}));

export const likeUlasanMatkul = pgTable("like_ulasan_matkul", {
  id_like: uuid("id_like").defaultRandom().primaryKey().notNull(),
  id_user: uuid("id_user").references(() => users.id_user, { onDelete: "cascade" }).notNull(),
  id_dosen: uuid("id_dosen").references(() => dosen.id_dosen, { onDelete: "cascade" }),
  id_ulasan: uuid("id_ulasan").references(() => ulasan.id_ulasan, { onDelete: "cascade" }),
  id_matkul: uuid("id_matkul").references(() => mataKuliah.id_matkul, { onDelete: "cascade" }),
});

export const likeUlasanMatkulRelations = relations(likeUlasanMatkul, ({ one }) => ({
  user: one(users, { fields: [likeUlasanMatkul.id_user], references: [users.id_user] }),
  dosen: one(dosen, { fields: [likeUlasanMatkul.id_dosen], references: [dosen.id_dosen] }),
  ulasan: one(ulasan, { fields: [likeUlasanMatkul.id_ulasan], references: [ulasan.id_ulasan] }),
  mataKuliah: one(mataKuliah, { fields: [likeUlasanMatkul.id_matkul], references: [mataKuliah.id_matkul] }),
}));

export const report = pgTable("report", {
  id_report: uuid("id_report").defaultRandom().primaryKey().notNull(),
  id_user: uuid("id_user").references(() => users.id_user, { onDelete: "cascade" }).notNull(),
  id_dosen: uuid("id_dosen").references(() => dosen.id_dosen, { onDelete: "cascade" }),
  id_ulasan: uuid("id_ulasan").references(() => ulasan.id_ulasan, { onDelete: "cascade" }),
  jenis_laporan: varchar("jenis_laporan", { length: 100 }),
  deskripsi: text("deskripsi"),
  status: varchar("status", { length: 50 }).default("pending"),
  tanggal_laporan: timestamp("tanggal_laporan").defaultNow(),
});

export const reportRelations = relations(report, ({ one }) => ({
  user: one(users, { fields: [report.id_user], references: [users.id_user] }),
  dosen: one(dosen, { fields: [report.id_dosen], references: [dosen.id_dosen] }),
  ulasan: one(ulasan, { fields: [report.id_ulasan], references: [ulasan.id_ulasan] }),
}));

export const forumUlasan = pgTable("forum_ulasan", {
  id_forum: uuid("id_forum").defaultRandom().primaryKey().notNull(),
  id_user: uuid("id_user").references(() => users.id_user, { onDelete: "cascade" }).notNull(),
  id_matkul: uuid("id_matkul").references(() => mataKuliah.id_matkul, { onDelete: "cascade" }).notNull(),
  judul_forum: text("judul_forum").notNull(),
  deskripsi: text("teks_forum"),
  created_at: timestamp("created_at").defaultNow(),
})

export const chatbotHistory = pgTable("chatbot_history", {
  id_chatbot: uuid("id_chatbot").defaultRandom().primaryKey().notNull(),
  id_user: uuid("id_user").references(() => users.id_user, { onDelete: "cascade" }).notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  created_at: timestamp("created_at").defaultNow(),
})