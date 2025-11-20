# ARMETA V2 - Backend API

Backend API menggunakan Express.js, PostgreSQL, dan Drizzle ORM.

## Prerequisites

- Node.js (v18 atau lebih tinggi)
- PostgreSQL (v14 atau lebih tinggi)
- npm atau yarn

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Copy file `.env.example` menjadi `.env` dan sesuaikan konfigurasinya:

```bash
cp .env.example .env
```

Edit file `.env` dengan kredensial database Anda:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=armeta_db

CORS_ORIGIN=http://localhost:3000
```

### 3. Setup Database

Pastikan PostgreSQL sudah running dan buat database baru:

```sql
CREATE DATABASE armeta_db;
```

### 4. Generate dan Run Migrations

```bash
# Generate migration files dari schema
npm run db:generate

# Push schema ke database (untuk development)
npm run db:push

# Atau jalankan migrations (untuk production)
npm run db:migrate
```

## Development

Jalankan development server dengan hot reload:

```bash
npm run dev
```

Server akan berjalan di `http://localhost:3000`

## Production

Jalankan production server:

```bash
npm start
```

## Scripts

- `npm run dev` - Jalankan development server dengan hot reload (nodemon)
- `npm start` - Jalankan production server
- `npm run db:generate` - Generate migration files dari schema
- `npm run db:migrate` - Jalankan migrations
- `npm run db:push` - Push schema langsung ke database (development)
- `npm run db:studio` - Buka Drizzle Studio untuk database management

## Project Structure

```
src/
├── app.js                  # Entry point aplikasi
├── config/                 # Konfigurasi aplikasi
├── db/
│   ├── index.js           # Database connection
│   └── schema/            # Database schemas
│       └── example.schema.js
├── routes/                # Route handlers
│   └── example.routes.js
├── controllers/           # Business logic
│   └── example.controller.js
├── middleware/            # Custom middleware
└── utils/                 # Utility functions
```

## API Endpoints

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2025-01-14T10:00:00.000Z"
}
```

### Root

```
GET /
```

Response:
```json
{
  "message": "Welcome to ARMETA V2 API",
  "status": "running",
  "timestamp": "2025-01-14T10:00:00.000Z"
}
```

## Database Schema

Contoh schema ada di `src/db/schema/example.schema.js`. Anda bisa membuat schema baru atau memodifikasi yang sudah ada.

### Membuat Schema Baru

1. Buat file baru di `src/db/schema/`, contoh: `users.schema.js`
2. Define table menggunakan Drizzle ORM:

```javascript
import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

3. Jalankan `npm run db:generate` untuk generate migrations
4. Jalankan `npm run db:push` atau `npm run db:migrate`

## Drizzle Studio

Buka database management UI:

```bash
npm run db:studio
```

## Technologies

- Express.js - Web framework
- JavaScript (ES Modules) - Programming language
- PostgreSQL - Database
- Drizzle ORM - Type-safe ORM
- CORS - Cross-Origin Resource Sharing
- dotenv - Environment variables
- Nodemon - Development auto-reload
