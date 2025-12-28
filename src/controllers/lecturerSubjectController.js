import { db } from "../db/db.js";
import { lecturers, subjects } from "../db/schema/schema.js";
import { eq, sql } from "drizzle-orm";

import {
  BadRequestError,
  NotFoundError,
} from "../utils/customError.js";

import { asyncHandler } from "../utils/asyncHandler.js";

const getLecturers = asyncHandler(async (req, res) => {
  const dataLecturers = await db.execute(sql`SELECT id_lecturer, name, faculty FROM lecturers`);

  if (dataLecturers.rows.length == 0) {
    throw new NotFoundError("Lecturers not found");
  }

  return res.status(200).json({
    data: dataLecturers.rows,
    status: true,
    message: "Success get all lecturers",
  });
})

const getSubjects = asyncHandler(async (req, res) => {
  const dataSubjects = await db.execute(sql`SELECT id_subject, code, name, semester FROM subjects`);

  if (dataSubjects.rows.length == 0) {
    throw new NotFoundError("Subjects not found");
  }

  return res.status(200).json({
    data: dataSubjects.rows,
    status: true,
    message: "Success get all subjects",
  });
})

const createLecturer = asyncHandler(async (req, res) => {
  const { name, npm, email, faculty } = req.body;

  if (!name || !faculty) {
    throw new BadRequestError("Name and faculty are required");
  }

  const [newLecturer] = await db
    .insert(lecturers)
    .values({ name, npm, email, faculty })
    .returning();

  return res.status(201).json({
    data: newLecturer,
    status: true,
    message: "Lecturer created successfully",
  });
});

const updateLecturer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, npm, email, faculty } = req.body;

  const [updatedLecturer] = await db
    .update(lecturers)
    .set({ name, npm, email, faculty, updated_at: new Date() })
    .where(eq(lecturers.id_lecturer, id))
    .returning();

  if (!updatedLecturer) {
    throw new NotFoundError("Lecturer not found");
  }

  return res.status(200).json({
    data: updatedLecturer,
    status: true,
    message: "Lecturer updated successfully",
  });
});

const deleteLecturer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [deletedLecturer] = await db
    .delete(lecturers)
    .where(eq(lecturers.id_lecturer, id))
    .returning();

  if (!deletedLecturer) {
    throw new NotFoundError("Lecturer not found");
  }

  return res.status(200).json({
    status: true,
    message: "Lecturer deleted successfully",
  });
});

const createSubject = asyncHandler(async (req, res) => {
  const { code, name, semester } = req.body;

  if (!code || !name) {
    throw new BadRequestError("Code and name are required");
  }

  const [newSubject] = await db
    .insert(subjects)
    .values({ code, name, semester })
    .returning();

  return res.status(201).json({
    data: newSubject,
    status: true,
    message: "Subject created successfully",
  });
});

const updateSubject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { code, name, semester } = req.body;

  const [updatedSubject] = await db
    .update(subjects)
    .set({ code, name, semester })
    .where(eq(subjects.id_subject, id))
    .returning();

  if (!updatedSubject) {
    throw new NotFoundError("Subject not found");
  }

  return res.status(200).json({
    data: updatedSubject,
    status: true,
    message: "Subject updated successfully",
  });
});

const deleteSubject = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [deletedSubject] = await db
    .delete(subjects)
    .where(eq(subjects.id_subject, id))
    .returning();

  if (!deletedSubject) {
    throw new NotFoundError("Subject not found");
  }

  return res.status(200).json({
    status: true,
    message: "Subject deleted successfully",
  });
});

export {
  getLecturers,
  getSubjects,
  createLecturer,
  updateLecturer,
  deleteLecturer,
  createSubject,
  updateSubject,
  deleteSubject
}