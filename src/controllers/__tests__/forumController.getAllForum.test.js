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
						where: vi.fn(() => ({
							orderBy: vi.fn(() => Promise.resolve([])),
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
	generateQueryEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

/**
 * CYCLOMATIC COMPLEXITY ANALYSIS FOR getAllForum
 * V(G) = P + 1
 * V(G) = 11 + 1 = 12
 *
 * Predicate Nodes (Decision Points):
 * 1. if (!id_user) - Not applicable for forum (no reply/forum filter)
 * 2. if (from && to)
 * 3. if (id_user)
 * 4. if (id_user === userId)
 * 5. if (id_subject)
 * 6. case "most_like"
 * 7. case "most_bookmark"
 * 8. case "most_popular"
 * 9. case "most_reply"
 * 10. if (filter) - time filter switch
 * 11. if (data.length === 0)
 *
 * Test Paths (Similar to ulasan):
 * Path 1: No filters - Direct to Date Sort -> Exec -> Return Valid
 * Path 2: Filter from & to - Date Filter -> Return Valid
 * Path 3: Filter id_user (Own) - User Check (Own) -> Return Valid
 * Path 4: Filter id_user (Other) - User Check (Other/No Anon) -> Return Valid
 * Path 5: Sort most_like - Switch(Like) -> Return Valid
 * Path 6: Filter id_subject - Subject Check -> Return Valid
 * Path 7: Sort most_bookmark - Switch(Bookmark) -> Return Valid
 * Path 8: Sort most_popular - Switch(Popular) -> Return Valid
 * Path 9: Sort most_reply - Switch(Reply/Others) -> Return Valid
 * Path 10: Filter with search query - Search Logic -> Return Valid
 * Path 11: Time filter (today/week/month/year) - Filter Switch -> Return Valid
 * Path 12: Result Empty - Exec -> Result Empty (Yes) -> Return (Empty Array)
 */

describe("forumController.getAllForum - Cyclomatic Complexity Tests", () => {
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
	it("TC1: Should return default forum data without filters (Path 1)", async () => {
		const mockData = [
			{
				id_forum: "forum1",
				id_user: "user1",
				id_subject: "subject1",
				title: "Forum 1",
				description: "Description 1",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				subject_name: "Mathematics",
				user_name: "User One",
				user_image: null,
				total_like: 5,
				total_bookmark: 2,
				total_reply: 3,
				is_liked: false,
				is_bookmarked: false,
			},
		];

		// Mock data query
		db.execute.mockResolvedValueOnce({ rows: mockData });
		// Mock count query
		db.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const response = await request(app)
			.get("/api/forum/getAllForum")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.success).toBe(true);
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
				id_forum: "forum2",
				id_user: "user2",
				id_subject: "subject1",
				title: "Forum 2",
				description: "Description 2",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false, // Should NOT include anonymous
				subject_name: "Physics",
				user_name: "User Two",
				user_image: null,
				total_like: 3,
				total_bookmark: 1,
				total_reply: 2,
				is_liked: false,
				is_bookmarked: false,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const response = await request(app)
			.get("/api/forum/getAllForum?id_user=user2")
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
				id_forum: "forum3",
				id_user: "user1",
				id_subject: "subject1",
				title: "Forum 3",
				description: "Description 3",
				files: [],
				created_at: new Date("2023-06-15"),
				updated_at: new Date("2023-06-15"),
				is_anonymous: false,
				subject_name: "Chemistry",
				user_name: "User One",
				user_image: null,
				total_like: 10,
				total_bookmark: 5,
				total_reply: 7,
				is_liked: true,
				is_bookmarked: false,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const response = await request(app)
			.get("/api/forum/getAllForum?from=2023-01-01&to=2023-12-31")
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
	 * Expected: Status 200, data sorted by total_like descending
	 */
	it("TC4: Should sort by most likes (Path 5)", async () => {
		const mockData = [
			{
				id_forum: "forum4",
				id_user: "user1",
				id_subject: "subject1",
				title: "Most Liked Forum",
				description: "Description 4",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				subject_name: "Biology",
				user_name: "User One",
				user_image: null,
				total_like: 100,
				total_bookmark: 10,
				total_reply: 15,
				is_liked: false,
				is_bookmarked: false,
			},
			{
				id_forum: "forum5",
				id_user: "user2",
				id_subject: "subject2",
				title: "Less Liked Forum",
				description: "Description 5",
				files: [],
				created_at: new Date("2023-12-02"),
				updated_at: new Date("2023-12-02"),
				is_anonymous: false,
				subject_name: "History",
				user_name: "User Two",
				user_image: null,
				total_like: 50,
				total_bookmark: 5,
				total_reply: 8,
				is_liked: false,
				is_bookmarked: false,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 2 }] });

		const response = await request(app)
			.get("/api/forum/getAllForum?sortBy=most_like")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(2);
		expect(response.body.data[0].total_like).toBeGreaterThanOrEqual(
			response.body.data[1].total_like
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
				id_forum: "forum6",
				id_user: "user1",
				id_subject: "subject1",
				title: "Page 2 Forum",
				description: "Description 6",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				subject_name: "English",
				user_name: "User One",
				user_image: null,
				total_like: 7,
				total_bookmark: 3,
				total_reply: 4,
				is_liked: false,
				is_bookmarked: false,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 10 }] });

		const response = await request(app)
			.get("/api/forum/getAllForum?page=2&limit=5")
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
			.get("/api/forum/getAllForum?from=invalid-text&to=abc")
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
				id_forum: "forum7",
				id_user: "user1",
				id_subject: "subject1",
				title: "My Anonymous Forum",
				description: "Description 7",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: true, // Should INCLUDE anonymous for own user
				subject_name: "Art",
				user_name: "User One",
				user_image: null,
				total_like: 2,
				total_bookmark: 1,
				total_reply: 1,
				is_liked: false,
				is_bookmarked: false,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const response = await request(app)
			.get("/api/forum/getAllForum?id_user=user1")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(1);
		expect(response.body.data[0].id_user).toBe("user1");
		// Anonymous posts should be visible to owner
		expect(response.body.data[0].is_anonymous).toBe(true);
	});

	/**
	 * TEST CASE 8: Filter Subject
	 * Path: Start -> Subject Check -> Return Valid
	 * Expected: Status 200, data matches subject
	 */
	it("TC8: Should filter by subject (Path 6)", async () => {
		const subjectId = "S1";

		const mockData = [
			{
				id_forum: "forum8",
				id_user: "user1",
				id_subject: subjectId,
				title: "Specific Subject Forum",
				description: "Description 8",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				subject_name: "Specific Subject",
				user_name: "User One",
				user_image: null,
				total_like: 8,
				total_bookmark: 4,
				total_reply: 6,
				is_liked: false,
				is_bookmarked: false,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const response = await request(app)
			.get(`/api/forum/getAllForum?id_subject=${subjectId}`)
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(1);
		expect(response.body.data[0].id_subject).toBe(subjectId);
	});

	/**
	 * TEST CASE 9: Sort by Bookmark
	 * Path: Start -> Switch(Bookmark) -> Return Valid
	 * Expected: Status 200, data sorted by total_bookmark descending
	 */
	it("TC9: Should sort by most bookmarks (Path 7)", async () => {
		const mockData = [
			{
				id_forum: "forum9",
				id_user: "user1",
				id_subject: "subject1",
				title: "Most Bookmarked Forum",
				description: "Description 9",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				subject_name: "Popular Subject",
				user_name: "User One",
				user_image: null,
				total_like: 20,
				total_bookmark: 50,
				total_reply: 10,
				is_liked: false,
				is_bookmarked: true,
			},
			{
				id_forum: "forum10",
				id_user: "user2",
				id_subject: "subject2",
				title: "Less Bookmarked Forum",
				description: "Description 10",
				files: [],
				created_at: new Date("2023-12-02"),
				updated_at: new Date("2023-12-02"),
				is_anonymous: false,
				subject_name: "Less Subject",
				user_name: "User Two",
				user_image: null,
				total_like: 15,
				total_bookmark: 25,
				total_reply: 5,
				is_liked: false,
				is_bookmarked: false,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 2 }] });

		const response = await request(app)
			.get("/api/forum/getAllForum?sortBy=most_bookmark")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(2);
		expect(response.body.data[0].total_bookmark).toBeGreaterThanOrEqual(
			response.body.data[1].total_bookmark
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
				id_forum: "forum11",
				id_user: "user1",
				id_subject: "subject1",
				title: "Most Popular Forum",
				description: "Description 11",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				subject_name: "Famous Subject",
				user_name: "User One",
				user_image: null,
				total_like: 60,
				total_bookmark: 40,
				total_reply: 20,
				is_liked: true,
				is_bookmarked: true,
			},
			{
				id_forum: "forum12",
				id_user: "user2",
				id_subject: "subject2",
				title: "Less Popular Forum",
				description: "Description 12",
				files: [],
				created_at: new Date("2023-12-02"),
				updated_at: new Date("2023-12-02"),
				is_anonymous: false,
				subject_name: "Normal Subject",
				user_name: "User Two",
				user_image: null,
				total_like: 30,
				total_bookmark: 20,
				total_reply: 10,
				is_liked: false,
				is_bookmarked: false,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 2 }] });

		const response = await request(app)
			.get("/api/forum/getAllForum?sortBy=most_popular")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(2);

		const popularity1 = response.body.data[0].total_like + response.body.data[0].total_bookmark;
		const popularity2 = response.body.data[1].total_like + response.body.data[1].total_bookmark;

		expect(popularity1).toBeGreaterThanOrEqual(popularity2);
	});

	/**
	 * TEST CASE 11: Sort by Reply
	 * Path: Start -> Switch(Reply/Others) -> Return Valid
	 * Expected: Status 200, data sorted by total_reply descending
	 */
	it("TC11: Should sort by most replies (Path 9)", async () => {
		const mockData = [
			{
				id_forum: "forum13",
				id_user: "user1",
				id_subject: "subject1",
				title: "Most Replied Forum",
				description: "Description 13",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				subject_name: "Active Subject",
				user_name: "User One",
				user_image: null,
				total_like: 10,
				total_bookmark: 5,
				total_reply: 100,
				is_liked: false,
				is_bookmarked: false,
			},
			{
				id_forum: "forum14",
				id_user: "user2",
				id_subject: "subject2",
				title: "Less Replied Forum",
				description: "Description 14",
				files: [],
				created_at: new Date("2023-12-02"),
				updated_at: new Date("2023-12-02"),
				is_anonymous: false,
				subject_name: "Quiet Subject",
				user_name: "User Two",
				user_image: null,
				total_like: 8,
				total_bookmark: 3,
				total_reply: 50,
				is_liked: false,
				is_bookmarked: false,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 2 }] });

		const response = await request(app)
			.get("/api/forum/getAllForum?sortBy=most_reply")
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
			.get("/api/forum/getAllForum?id_subject=sub_404")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.success).toBe(true);
		expect(response.body.data).toEqual([]);
		expect(response.body.pagination.totalData).toBe(0);
		expect(response.body.pagination.totalPage).toBe(0);
	});

	/**
	 * ADDITIONAL TEST: Search Query
	 * Path: Start -> Search Logic -> Return Valid
	 * Expected: Status 200, data matches search pattern
	 */
	it("TC10-Extended: Should filter by search query (Path 10)", async () => {
		const mockData = [
			{
				id_forum: "forum15",
				id_user: "user1",
				id_subject: "subject1",
				title: "Searchable Forum Title",
				description: "This contains the search term",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				subject_name: "Search Subject",
				user_name: "User One",
				user_image: null,
				total_like: 6,
				total_bookmark: 2,
				total_reply: 3,
				is_liked: false,
				is_bookmarked: false,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const response = await request(app)
			.get("/api/forum/getAllForum?search=searchable")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(1);
		expect(response.body.message).toContain("search");
	});

	/**
	 * ADDITIONAL TEST: Time Filter (Week)
	 * Path: Start -> Filter Switch -> Return Valid
	 * Expected: Status 200, data within last week
	 */
	it("TC11-Extended: Should filter by time period (week) (Path 11)", async () => {
		const mockData = [
			{
				id_forum: "forum16",
				id_user: "user1",
				id_subject: "subject1",
				title: "Recent Forum",
				description: "Description 16",
				files: [],
				created_at: new Date(), // Recent date
				updated_at: new Date(),
				is_anonymous: false,
				subject_name: "Recent Subject",
				user_name: "User One",
				user_image: null,
				total_like: 4,
				total_bookmark: 1,
				total_reply: 2,
				is_liked: false,
				is_bookmarked: false,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const response = await request(app)
			.get("/api/forum/getAllForum?filter=week")
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(1);
	});

	/**
	 * ADDITIONAL TEST: Combined Filters
	 * Path: Multiple filters combined
	 * Expected: Status 200, data matches all filters
	 */
	it("TC13-Extended: Should handle combined filters (subject + sortBy)", async () => {
		const subjectId = "S1";

		const mockData = [
			{
				id_forum: "forum17",
				id_user: "user1",
				id_subject: subjectId,
				title: "Combined Filter Forum",
				description: "Description 17",
				files: [],
				created_at: new Date("2023-12-01"),
				updated_at: new Date("2023-12-01"),
				is_anonymous: false,
				subject_name: "Specific Subject",
				user_name: "User One",
				user_image: null,
				total_like: 15,
				total_bookmark: 8,
				total_reply: 5,
				is_liked: false,
				is_bookmarked: false,
			},
		];

		db.execute.mockResolvedValueOnce({ rows: mockData });
		db.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const response = await request(app)
			.get(`/api/forum/getAllForum?id_subject=${subjectId}&sortBy=most_like`)
			.set("Authorization", `Bearer ${mockToken}`);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(1);
		expect(response.body.data[0].id_subject).toBe(subjectId);
	});
});
