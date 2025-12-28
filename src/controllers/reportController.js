import { sql } from "drizzle-orm";
import { db } from "../db/db.js";

import { asyncHandler } from "../utils/asyncHandler.js";

import { BadRequestError } from "../utils/customError.js";

const createReport = asyncHandler(async (req, res) => {
	const userId = req.user.id_user;
	let { id_review, id_lecturer, id_forum, type, body } = req.body;

	id_review = !id_review || id_review === "" ? null : id_review;
	id_lecturer = !id_lecturer || id_lecturer === "" ? null : id_lecturer;
	id_forum = !id_forum || id_forum === "" ? null : id_forum;

	if (!type) {
		throw new BadRequestError("Type laporan wajib diisi.");
	}

	if (!id_review && !id_lecturer && !id_forum) {
		throw new BadRequestError(
			"Laporan harus merujuk ke Review, Dosen, atau Forum (id_review, id_lecturer, atau id_forum wajib diisi salah satunya)."
		);
	}

	const status = "Pending";

	const result = await db.execute(
		sql`INSERT INTO reports (id_user, id_review, id_lecturer, id_forum, report_type, body, report_status)
            VALUES (
                ${userId}, 
                ${id_review ? id_review : sql`NULL`}::uuid, 
                ${id_lecturer ? id_lecturer : sql`NULL`}::uuid, 
                ${id_forum ? id_forum : sql`NULL`}::uuid, 
                ${type}, 
                ${body}, 
                ${status}
            )
            RETURNING *`
	);
	return res.status(200).json({
		success: true,
		message: "Report created successfully",
		data: {
			...result.rows[0],
			type: result.rows[0].report_type,
			status: result.rows[0].report_status,
		},
	});
});

const getReports = asyncHandler(async (req, res) => {
	const userId = req.user.id_user;

	if (!userId) {
		throw new BadRequestError("User id wajib diisi.");
	}

	const reportsList = await db.execute(
		sql`SELECT * FROM reports WHERE id_user = ${userId} ORDER BY created_at DESC`
	);

	const mappedReports = reportsList.rows.map((row) => ({
		...row,
		type: row.report_type,
		status: row.report_status,
	}));

	return res.status(200).json({
		success: true,
		message: "Reports retrieved successfully",
		data: mappedReports,
	});
});

export { createReport, getReports };
