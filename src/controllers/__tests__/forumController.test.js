import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { db } from '../../db/db.js';
import jwt from 'jsonwebtoken';

vi.mock('../../db/db.js', () => ({
    db: {
        execute: vi.fn(),
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                leftJoin: vi.fn(() => ({
                    where: vi.fn(() => ({
                        orderBy: vi.fn(() => Promise.resolve([])),
                    })),
                })),
            })),
        })),
    }
}));

vi.mock('jsonwebtoken');

describe('forumController Integration Tests', () => {
    const mockToken = 'valid-token';
    const mockUser = { id_user: 'user-uuid', email: 'test@test.com', is_banned: false };

    beforeEach(() => {
        vi.clearAllMocks();
        jwt.verify.mockImplementation((token, secret, callback) => {
            callback(null, mockUser);
        });
    });

    describe('GET /api/forum/getAllForum', () => {
        it('should return a list of forums', async () => {
            // Mocking the main forum query
            db.execute.mockResolvedValueOnce({
                rows: [
                    {
                        id_forum: '1',
                        title: 'Test Forum',
                        description: 'Test Desc',
                        user_name: 'Test User',
                        total_like: 0,
                        total_bookmark: 0,
                        total_reply: 0,
                        is_liked: false,
                        is_bookmarked: false
                    }
                ]
            });
            // Mocking the total count query
            db.execute.mockResolvedValueOnce({
                rows: [{ count: 1 }]
            });

            const response = await request(app)
                .get('/api/forum/getAllForum')
                .set('Authorization', `Bearer ${mockToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].title).toBe('Test Forum');
        });
    });

    describe('GET /api/forum/searchForum', () => {
        it('should return 400 if query param q is missing', async () => {
            const response = await request(app)
                .get('/api/forum/searchForum')
                .set('Authorization', `Bearer ${mockToken}`);

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Silakan masukkan kata kunci pencarian.');
        });

        it('should return search results when query is provided', async () => {
            db.execute.mockResolvedValueOnce({
                rows: [
                    { id_forum: '2', title: 'Search Result', is_anonymous: false, user_name: 'User' }
                ]
            });

            const response = await request(app)
                .get('/api/forum/searchForum?q=Search')
                .set('Authorization', `Bearer ${mockToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].title).toBe('Search Result');
        });
    });

    describe('GET /api/forum/getForumId', () => {
        it('should return 400 if id_forum is missing', async () => {
            const response = await request(app)
                .get('/api/forum/getForumId')
                .set('Authorization', `Bearer ${mockToken}`);

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('id_forum wajib diisi');
        });
    });

    describe('POST /api/forum/likeForum', () => {
        it('should fail if id_forum is not provided', async () => {
            const response = await request(app)
                .post('/api/forum/likeForum')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({});

            expect(response.status).toBe(400);
        });
    });
});
