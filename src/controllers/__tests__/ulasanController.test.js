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
    }
}));

vi.mock('jsonwebtoken');
vi.mock('../../service/vectorizationService.js', () => ({
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

describe('ulasanController Integration Tests', () => {
    const mockToken = 'valid-token';
    const mockUser = { id_user: 'user-uuid', email: 'test@test.com', is_banned: false };

    beforeEach(() => {
        vi.clearAllMocks();
        jwt.verify.mockImplementation((token, secret, callback) => {
            callback(null, mockUser);
        });
    });

    describe('GET /api/ulasan/getUlasan', () => {
        it('should return a list of ulasan', async () => {
            db.execute.mockResolvedValueOnce({
                rows: [
                    { id_review: '1', title: 'Test Review', body: 'Test Body', user_name: 'Test User' }
                ]
            });
            db.execute.mockResolvedValueOnce({
                rows: [{ count: 1 }]
            });

            const response = await request(app)
                .get('/api/ulasan/getUlasan')
                .set('Authorization', `Bearer ${mockToken}`);

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data).toHaveLength(1);
        });
    });

    describe('GET /api/ulasan/getUlasanById', () => {
        it('should return 400 if id_review is missing', async () => {
            const response = await request(app)
                .get('/api/ulasan/getUlasanById')
                .set('Authorization', `Bearer ${mockToken}`);

            expect(response.status).toBe(400);
        });
    });
});
