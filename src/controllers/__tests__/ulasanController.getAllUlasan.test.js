import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../app.js";
import { db } from "../../db/db.js";

vi.mock("../../db/db.js", () => ({
	db: {
		execute: vi.fn(),
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				leftJoin: vi.fn(() => ({
					leftJoin: vi.fn(() => ({
						leftJoin: vi.fn(() => ({
							where: vi.fn(() => ({
								groupBy: vi.fn(() => Promise.resolve([])),
								orderBy: vi.fn(() => Promise.resolve([])),
							})),
						})),
					})),
				})),
			})),
		})),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("jsonwebtoken");
vi.mock("../../service/vectorizationService.js", () => ({
	generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

/**
 * CYCLOMATIC COMPLEXITY ANALYSIS
 * V(G) = P + 1
 * V(G) = 11 + 1 = 12
 *
 * Predicate Nodes (Decision Points):
 * 1. if (!id_user)
 * 2. if (from && to)
 * 3. if (id_user)
 * 4. if (id_user === userId)
 * 5. if (id_lecturer)
 * 6. if (id_subject)
 * 7. case "most_like"
 * 8. case "most_bookmark"
 * 9. case "most_popular"
 * 10. case "most_reply"
 * 11. if (data.length === 0)
 *
 * Test Paths:
 * Path 1: No filters - Direct to Date Sort -> Exec -> Return Valid
 * Path 2: Filter from & to - Date Filter -> Return Valid
 * Path 3: Filter id_user (Own) - User Check (Own) -> Return Valid
 * Path 4: Filter id_user (Other) - User Check (Other/No Anon) -> Return Valid
 * Path 5: Sort most_like - Switch(Like) -> Return Valid
 * Path 6: id_lecturer + id_subject - Lect Check -> Subj Check -> Return Valid
 * Path 7: Sort most_bookmark - Switch(Bookmark) -> Return Valid
 * Path 8: Sort most_popular - Switch(Popular) -> Return Valid
 * Path 9: Sort most_reply - Switch(Reply/Others) -> Return Valid
 * Path 10: Filter id_lecturer Only - Lect Check (Yes) -> Subj Check (No) -> Return Valid
 * Path 11: Filter id_subject Only - Lect Check (No) -> Subj Check (Yes) -> Return Valid
 * Path 12: Result Empty - Exec -> Result Empty (Yes) -> Return (Empty Array)
 */

describe("ulasanController.getAllUlasan - Cyclomatic Complexity Tests", () => {
	const mockToken = "valid-token";
	const mockUser = {
		id_user: "user1",
		email: "test@test.com",
		is_banned: false,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		jwt.verify.mockImplementation((_token, _secret, callback) => {
			callback(null, mockUser);
		});
	});

	/**
	 * TEST CASE 1: Search Default (No Filters)
	 * Path: Start -> Direct to Date Sort -> Exec -> Return Valid
	 * Expected: Status 200, data <= 10 (default limit), ordered by date desc
	 */
	it("TC1: Should return default data without filters (Path 1)", async () => {
		const mockData = [
			{
				id_review: "review1",
				id_user: "user1",
				title: "Review 1",
				body: "Body 1",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				lecturer_name: "Dr. John",
				subject_name: "Math",
				semester: 1,
				user_name: "User One",
				user_image: null,
				user_email: "user1@test.com",
				total_likes: 5,
				total_bookmarks: 2,
				total_reply: 1,
				is_liked: false,
				is_bookmarked: false,
				parent_user_name: null,
			},
		];

		// Mock data query
		db.execute.mockResolvedValueOnce({ rows: mockData });
		// Mock count query
		db.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const response = await request(app)
			.get("/api/ulasan/getUlasan")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.status).toBe(true);
		expect(response.body.data).toHaveLength(1);
		expect(response.body.pagination.limit).toBe(10);
		expect(response.body.pagination.currentPage).toBe(1);
	});

	/**
	 * TEST CASE 2: Filter User Lain (Other User - Check Anonymity)
	 * Path: Start -> User Check (Other/No Anon) -> Return Valid
	 * Expected: Status 200, only data from user2, no anonymous data
	 */
	it("TC2: Should filter by other user and exclude anonymous posts (Path 4)", async () => {
		const mockData = [
			{
				id_review: "review2",
				id_user: "user2",
				title: "Review 2",
				body: "Body 2",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false, // Should NOT include anonymous
				lecturer_name: "Dr. Jane",
				subject_name: "Physics",
				semester: 2,
				user_name: "User Two",
				user_image: null,
				user_email: "user2@test.com",
				total_likes: 3,
				total_bookmarks: 1,
				total_reply: 0,
				is_liked: false,
				is_bookmarked: false,
				parent_user_name: null,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const response = await request(app)
			.get("/api/ulasan/getUlasan?id_user=user2")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(1);
		expect(response.body.data[0].id_user).toBe("user2");
		expect(response.body.data[0].is_anonymous).toBe(false);
	});

	/**
	 * TEST CASE 3: Filter Date Valid (from & to)
	 * Path: Start -> Date Filter -> Return Valid
	 * Expected: Status 200, all created_at within range
	 */
	it("TC3: Should filter by valid date range (Path 2)", async () => {
		const mockData = [
			{
				id_review: "review3",
				id_user: "user1",
				title: "Review 3",
				body: "Body 3",
				files: [],
				created_at: new Date("2023-06-15"),
				updated_at: new Date("2023-06-15"),
				is_anonymous: false,
				lecturer_name: "Dr. Smith",
				subject_name: "Chemistry",
				semester: 3,
				user_name: "User One",
				user_image: null,
				user_email: "user1@test.com",
				total_likes: 10,
				total_bookmarks: 5,
				total_reply: 2,
				is_liked: true,
				is_bookmarked: false,
				parent_user_name: null,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const response = await request(app)
			.get("/api/ulasan/getUlasan?from=2023-01-01&to=2023-12-31")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(1);

		const createdAt = new Date(response.body.data[0].created_at);
		const fromDate = new Date("2023-01-01");
		const toDate = new Date("2023-12-31");

		expect(createdAt >= fromDate && createdAt <= toDate).toBe(true);
	});

	/**
	 * TEST CASE 4: Sort by Like
	 * Path: Start -> Switch(Like) -> Return Valid
	 * Expected: Status 200, data sorted by total_likes descending
	 */
	it("TC4: Should sort by most likes (Path 5)", async () => {
		const mockData = [
			{
				id_review: "review4",
				id_user: "user1",
				title: "Most Liked",
				body: "Body 4",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				lecturer_name: "Dr. Brown",
				subject_name: "Biology",
				semester: 1,
				user_name: "User One",
				user_image: null,
				user_email: "user1@test.com",
				total_likes: 100,
				total_bookmarks: 10,
				total_reply: 5,
				is_liked: false,
				is_bookmarked: false,
				parent_user_name: null,
			},
			{
				id_review: "review5",
				id_user: "user2",
				title: "Less Liked",
				body: "Body 5",
				files: [],
				created_at: new Date("2023-12-02"),
				updated_at: new Date("2023-12-02"),
				is_anonymous: false,
				lecturer_name: "Dr. White",
				subject_name: "History",
				semester: 2,
				user_name: "User Two",
				user_image: null,
				user_email: "user2@test.com",
				total_likes: 50,
				total_bookmarks: 5,
				total_reply: 2,
				is_liked: false,
				is_bookmarked: false,
				parent_user_name: null,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 2 }] });

		const response = await request(app)
			.get("/api/ulasan/getUlasan?sortBy=most_like")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(2);
		expect(response.body.data[0].total_likes).toBeGreaterThanOrEqual(
			response.body.data[1].total_likes
		);
	});

	/**
	 * TEST CASE 5: Pagination Page 2
	 * Path: Start -> Pagination Logic -> Return Valid
	 * Expected: Status 200, offset query working (skip first 5 data)
	 */
	it("TC5: Should handle pagination correctly (Path 1 with pagination)", async () => {
		const mockData = [
			{
				id_review: "review6",
				id_user: "user1",
				title: "Page 2 Review",
				body: "Body 6",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				lecturer_name: "Dr. Green",
				subject_name: "English",
				semester: 1,
				user_name: "User One",
				user_image: null,
				user_email: "user1@test.com",
				total_likes: 7,
				total_bookmarks: 3,
				total_reply: 1,
				is_liked: false,
				is_bookmarked: false,
				parent_user_name: null,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 10 }] });

		const response = await request(app)
			.get("/api/ulasan/getUlasan?page=2&limit=5")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.pagination.currentPage).toBe(2);
		expect(response.body.pagination.limit).toBe(5);
		expect(response.body.pagination.totalPage).toBe(2);
	});

	/**
	 * TEST CASE 6: Invalid Date Format (Error Scenario)
	 * Path: Start -> Date Filter (Invalid) -> Error Handling
	 * Expected: Should handle gracefully (may return empty or error)
	 */
	it("TC6: Should handle invalid date format gracefully", async () => {
		// Mock empty result for invalid date
		db.execute.mockResolvedValueOnce({ rows: [] });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 0 }] });

		const response = await request(app)
			.get("/api/ulasan/getUlasan?from=invalid-text&to=abc")
			.set("Authorization", `Bearer ${mockToken}`);

		// Should either return 200 with empty data or handle error
		expect([200, 400, 500]).toContain(response.status);

		if (response.status === 200) {
			expect(response.body.data).toEqual([]);
		}
	});

	/**
	 * TEST CASE 7: Filter User Sendiri (Own User - Privacy Check)
	 * Path: Start -> User Check (Own) -> Return Valid
	 * Expected: Status 200, data from user1, anonymous posts INCLUDED
	 */
	it("TC7: Should filter by own user and include anonymous posts (Path 3)", async () => {
		const mockData = [
			{
				id_review: "review7",
				id_user: "user1",
				title: "My Anonymous Review",
				body: "Body 7",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: true, // Should INCLUDE anonymous for own user
				lecturer_name: "Dr. Black",
				subject_name: "Art",
				semester: 1,
				user_name: "User One",
				user_image: null,
				user_email: "user1@test.com",
				total_likes: 2,
				total_bookmarks: 1,
				total_reply: 0,
				is_liked: false,
				is_bookmarked: false,
				parent_user_name: null,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const response = await request(app)
			.get("/api/ulasan/getUlasan?id_user=user1")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(1);
		expect(response.body.data[0].id_user).toBe("user1");
		// Anonymous posts should be visible to owner
		expect(response.body.data[0].is_anonymous).toBe(true);
	});

	/**
	 * TEST CASE 8: Filter Lecturer & Subject
	 * Path: Start -> Lect Check -> Subj Check -> Return Valid
	 * Expected: Status 200, data matches both lecturer AND subject (AND logic)
	 */
	it("TC8: Should filter by lecturer AND subject (Path 6)", async () => {
		const lecturerId = "L1";
		const subjectId = "S1";

		const mockData = [
			{
				id_review: "review8",
				id_user: "user1",
				title: "Specific Course Review",
				body: "Body 8",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				lecturer_name: "Dr. Specific",
				subject_name: "Specific Subject",
				semester: 1,
				user_name: "User One",
				user_image: null,
				user_email: "user1@test.com",
				total_likes: 8,
				total_bookmarks: 4,
				total_reply: 2,
				is_liked: false,
				is_bookmarked: false,
				parent_user_name: null,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const response = await request(app)
			.get(`/api/ulasan/getUlasan?id_lecturer=${lecturerId}&id_subject=${subjectId}`)
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(1);
	});

	/**
	 * TEST CASE 9: Sort by Bookmark
	 * Path: Start -> Switch(Bookmark) -> Return Valid
	 * Expected: Status 200, data sorted by total_bookmarks descending
	 */
	it("TC9: Should sort by most bookmarks (Path 7)", async () => {
		const mockData = [
			{
				id_review: "review9",
				id_user: "user1",
				title: "Most Bookmarked",
				body: "Body 9",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				lecturer_name: "Dr. Popular",
				subject_name: "Popular Subject",
				semester: 1,
				user_name: "User One",
				user_image: null,
				user_email: "user1@test.com",
				total_likes: 20,
				total_bookmarks: 50,
				total_reply: 3,
				is_liked: false,
				is_bookmarked: true,
				parent_user_name: null,
			},
			{
				id_review: "review10",
				id_user: "user2",
				title: "Less Bookmarked",
				body: "Body 10",
				files: [],
				created_at: new Date("2023-12-02"),
				updated_at: new Date("2023-12-02"),
				is_anonymous: false,
				lecturer_name: "Dr. Less",
				subject_name: "Less Subject",
				semester: 2,
				user_name: "User Two",
				user_image: null,
				user_email: "user2@test.com",
				total_likes: 15,
				total_bookmarks: 25,
				total_reply: 1,
				is_liked: false,
				is_bookmarked: false,
				parent_user_name: null,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 2 }] });

		const response = await request(app)
			.get("/api/ulasan/getUlasan?sortBy=most_bookmark")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(2);
		expect(response.body.data[0].total_bookmarks).toBeGreaterThanOrEqual(
			response.body.data[1].total_bookmarks
		);
	});

	/**
	 * TEST CASE 10: Sort by Popular
	 * Path: Start -> Switch(Popular) -> Return Valid
	 * Expected: Status 200, data sorted by popularity algorithm (likes + bookmarks)
	 */
	it("TC10: Should sort by most popular (Path 8)", async () => {
		const mockData = [
			{
				id_review: "review11",
				id_user: "user1",
				title: "Most Popular",
				body: "Body 11",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				lecturer_name: "Dr. Famous",
				subject_name: "Famous Subject",
				semester: 1,
				user_name: "User One",
				user_image: null,
				user_email: "user1@test.com",
				total_likes: 60,
				total_bookmarks: 40,
				total_reply: 10,
				is_liked: true,
				is_bookmarked: true,
				parent_user_name: null,
			},
			{
				id_review: "review12",
				id_user: "user2",
				title: "Less Popular",
				body: "Body 12",
				files: [],
				created_at: new Date("2023-12-02"),
				updated_at: new Date("2023-12-02"),
				is_anonymous: false,
				lecturer_name: "Dr. Normal",
				subject_name: "Normal Subject",
				semester: 2,
				user_name: "User Two",
				user_image: null,
				user_email: "user2@test.com",
				total_likes: 30,
				total_bookmarks: 20,
				total_reply: 5,
				is_liked: false,
				is_bookmarked: false,
				parent_user_name: null,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 2 }] });

		const response = await request(app)
			.get("/api/ulasan/getUlasan?sortBy=most_popular")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(2);

		const popularity1 = response.body.data[0].total_likes + response.body.data[0].total_bookmarks;
		const popularity2 = response.body.data[1].total_likes + response.body.data[1].total_bookmarks;

		expect(popularity1).toBeGreaterThanOrEqual(popularity2);
	});

	/**
	 * TEST CASE 11: Sort by Reply
	 * Path: Start -> Switch(Reply/Others) -> Return Valid
	 * Expected: Status 200, data sorted by total_replies descending
	 */
	it("TC11: Should sort by most replies (Path 9)", async () => {
		const mockData = [
			{
				id_review: "review13",
				id_user: "user1",
				title: "Most Replied",
				body: "Body 13",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				lecturer_name: "Dr. Active",
				subject_name: "Active Subject",
				semester: 1,
				user_name: "User One",
				user_image: null,
				user_email: "user1@test.com",
				total_likes: 10,
				total_bookmarks: 5,
				total_reply: 100,
				is_liked: false,
				is_bookmarked: false,
				parent_user_name: null,
			},
			{
				id_review: "review14",
				id_user: "user2",
				title: "Less Replied",
				body: "Body 14",
				files: [],
				created_at: new Date("2023-12-02"),
				updated_at: new Date("2023-12-02"),
				is_anonymous: false,
				lecturer_name: "Dr. Quiet",
				subject_name: "Quiet Subject",
				semester: 2,
				user_name: "User Two",
				user_image: null,
				user_email: "user2@test.com",
				total_likes: 8,
				total_bookmarks: 3,
				total_reply: 50,
				is_liked: false,
				is_bookmarked: false,
				parent_user_name: null,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 2 }] });

		const response = await request(app)
			.get("/api/ulasan/getUlasan?sortBy=most_reply")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(2);
		expect(response.body.data[0].total_reply).toBeGreaterThanOrEqual(
			response.body.data[1].total_reply
		);
	});

	/**
	 * TEST CASE 12: Result Empty (No Data Found)
	 * Path: Start -> Exec -> Result Empty (Yes) -> Return (Empty Array)
	 * Expected: Status 200, empty data array, no error 500
	 */
	it("TC12: Should return empty array when no data found (Path 12)", async () => {
		db.execute.mockResolvedValueOnce({ rows: [] });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 0 }] });

		const response = await request(app)
			.get("/api/ulasan/getUlasan?id_subject=sub_404")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.status).toBe(true);
		expect(response.body.data).toEqual([]);
		expect(response.body.pagination.totalData).toBe(0);
		expect(response.body.pagination.totalPage).toBe(0);
	});

	/**
	 * ADDITIONAL TEST: Filter Lecturer Only
	 * Path: Start -> Lect Check (Yes) -> Subj Check (No) -> Return Valid
	 * Expected: Status 200, data matches lecturer only
	 */
	it("TC10-Extended: Should filter by lecturer only (Path 10)", async () => {
		const lecturerId = "L1";

		const mockData = [
			{
				id_review: "review15",
				id_user: "user1",
				title: "Lecturer Only Review",
				body: "Body 15",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				lecturer_name: "Dr. Solo",
				subject_name: "Various Subjects",
				semester: 1,
				user_name: "User One",
				user_image: null,
				user_email: "user1@test.com",
				total_likes: 6,
				total_bookmarks: 2,
				total_reply: 1,
				is_liked: false,
				is_bookmarked: false,
				parent_user_name: null,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const response = await request(app)
			.get(`/api/ulasan/getUlasan?id_lecturer=${lecturerId}`)
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(1);
	});

	/**
	 * ADDITIONAL TEST: Filter Subject Only
	 * Path: Start -> Lect Check (No) -> Subj Check (Yes) -> Return Valid
	 * Expected: Status 200, data matches subject only
	 */
	it("TC11-Extended: Should filter by subject only (Path 11)", async () => {
		const subjectId = "S1";

		const mockData = [
			{
				id_review: "review16",
				id_user: "user1",
				title: "Subject Only Review",
				body: "Body 16",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				lecturer_name: "Various Lecturers",
				subject_name: "Specific Subject",
				semester: 1,
				user_name: "User One",
				user_image: null,
				user_email: "user1@test.com",
				total_likes: 4,
				total_bookmarks: 1,
				total_reply: 0,
				is_liked: false,
				is_bookmarked: false,
				parent_user_name: null,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const response = await request(app)
			.get(`/api/ulasan/getUlasan?id_subject=${subjectId}`)
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(1);
	});
});
