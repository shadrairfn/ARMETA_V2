# ARMETA V2 - Backend API

Backend API menggunakan Express.js, PostgreSQL, Drizzle ORM, dan Voyage AI untuk vector similarity search.

## Prerequisites

**Untuk menjalankan dengan Docker (Recommended):**
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)
- Git

**Untuk menjalankan tanpa Docker:**
- Node.js (v18 atau lebih tinggi)
- PostgreSQL (v15 atau lebih tinggi dengan pgvector extension)
- npm atau yarn

## Setup dengan Docker (Recommended)

### 1. Clone Repository

```bash
git clone <repository-url>
cd backend
```

### 2. Setup Environment Variables

Copy file `.env.example` menjadi `.env` dan sesuaikan konfigurasinya:

```bash
cp .env.example .env
```

Edit file `.env` dan sesuaikan nilai-nilai berikut:

**Wajib diisi:**
- `GOOGLE_CLIENT_ID` - Dapatkan dari [Google Cloud Console](https://console.cloud.google.com/)
- `GOOGLE_CLIENT_SECRET` - Dapatkan dari Google Cloud Console
- `JWT_SECRET` - Generate dengan: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `JWT_REFRESH_SECRET` - Generate secret key yang berbeda
- `SESSION_SECRET` - Generate secret key lainnya
- `EMAIL_USER` - Email untuk mengirim notifikasi
- `EMAIL_PASS` - App Password dari Gmail ([cara setup](https://support.google.com/accounts/answer/185833))
- `FIREBASE_BUCKET` - Nama bucket dari Firebase Storage
- `VOYAGE_API_KEY` - API key dari [Voyage AI](https://www.voyageai.com/)

### 3. Setup Firebase Service Account

1. Buat project di [Firebase Console](https://console.firebase.google.com/)
2. Buka Project Settings > Service Accounts
3. Generate new private key
4. Simpan file JSON sebagai `src/firebase/serviceAccountKey.json`

### 4. Build dan Jalankan dengan Docker

```bash
# Build dan jalankan semua services (database + backend)
docker-compose up --build

# Atau jalankan di background
docker-compose up -d --build
```

Services yang akan berjalan:
- **Backend API**: http://127.0.0.1:3000
- **PostgreSQL Database**: localhost:5432 (dengan pgvector extension)

### 5. Melihat Logs

```bash
# Semua services
docker-compose logs -f

# Backend saja
docker logs -f armeta_backend

# Database saja
docker logs -f armeta_db
```

### 6. Menghentikan Services

```bash
# Stop semua services
docker-compose down

# Stop dan hapus volumes (WARNING: akan menghapus data database!)
docker-compose down -v
```

---

## Setup tanpa Docker (Manual)

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Ikuti langkah 2-3 dari Setup dengan Docker di atas.

### 3. Setup Database

Pastikan PostgreSQL 15+ dengan pgvector extension sudah running:

```sql
CREATE DATABASE armeta_v2;
\c armeta_v2;
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. Generate dan Run Migrations

```bash
# Push schema ke database (untuk development)
npm run db:push
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

### Authentication
- `GET /auth/google` - Login dengan Google OAuth
- `GET /auth/google/callback` - Callback OAuth
- `POST /auth/logout` - Logout user

### Users
- `GET /api/users/me` - Get user profile (requires auth)
- `POST /api/users/refresh` - Refresh access token

### Ulasan (Reviews)
- `POST /api/ulasan/ulasan` - Create new ulasan dengan file upload (requires auth)
- `POST /api/ulasan/search` - Search similar ulasan menggunakan vector similarity (requires auth)

### Root

```
GET /
```

Response:
```json
{
  "message": "Welcome to ARMETA V2 API",
  "status": "running"
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

- **Express.js 5.1.0** - Web framework
- **PostgreSQL 15** - Database dengan pgvector extension
- **Drizzle ORM** - Type-safe ORM
- **Passport.js** - Authentication dengan Google OAuth
- **Multer** - File upload middleware
- **Firebase Storage** - Cloud file storage
- **Voyage AI** - Vector embeddings (voyage-3 model, 1024 dimensions)
- **Docker & Docker Compose** - Containerization
- **bcryptjs** - Password hashing
- **JWT** - Token-based authentication

## Troubleshooting

### Container tidak bisa connect ke database
```bash
# Restart containers
docker-compose restart

# Check logs
docker-compose logs db
```

### Error: "Failed to generate embedding"
- Pastikan `VOYAGE_API_KEY` valid dan sudah diisi di `.env`
- Check API quota di Voyage AI dashboard

### Error saat upload file
- Pastikan `serviceAccountKey.json` ada di `src/firebase/`
- Verify `FIREBASE_BUCKET` di `.env` sudah benar

### Port 3000 sudah digunakan
```bash
# Edit docker-compose.yml, ubah port mapping:
ports:
  - "3001:3000"  # Ganti 3001 dengan port yang available
```

### Database migration error
```bash
# Masuk ke container dan push schema manual
docker exec -it armeta_backend sh
npm run db:push
exit
```
