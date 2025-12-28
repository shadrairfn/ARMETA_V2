import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('Health Check', () => {
    it('should return 200 OK for the root path', async () => {
        const response = await request(app).get('/');
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe("ARMETA API Server is running");
    });
});
