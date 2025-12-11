# ARMETA API Documentation

> **Version:** 1.0.0  
> **Base URL:** `http://localhost:{PORT}`

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Authentication Routes](#authentication-routes)
  - [User Routes](#user-routes)
  - [Ulasan (Review) Routes](#ulasan-review-routes)
  - [Forum Routes](#forum-routes)
  - [Report Routes](#report-routes)
  - [Chatbot Routes](#chatbot-routes)
- [Error Responses](#error-responses)
- [Data Types](#data-types)

---

## Overview

ARMETA API is a backend service for managing academic reviews, forums, and chatbot interactions. The API uses JWT (JSON Web Token) for authentication and supports Google OAuth2 login.

### Technologies Used

- **Framework:** Express.js 5
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** JWT + Passport.js (Google OAuth2)
- **File Storage:** Firebase Storage
- **AI/Vector Search:** VoyageAI + pgvector

---

## Authentication

### JWT Bearer Token

Most API endpoints require authentication via JWT Bearer token.

**Header Format:**
```
Authorization: Bearer <access_token>
```

### Token Types

| Token | Expiration | Purpose |
|-------|------------|---------|
| Access Token | Short-lived | API authentication |
| Refresh Token | Long-lived | Obtain new access tokens |

---

## API Endpoints

---

### Authentication Routes

Base path: `/auth`

#### 1. Google OAuth Login

Initiates Google OAuth2 authentication flow.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /auth/google/login` |
| **Auth Required** | No |

**Response:** Redirects to Google login page

---

#### 2. Google OAuth Callback

Handles callback from Google OAuth2.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /auth/google/callback` |
| **Auth Required** | No |

**Response:** Redirects to frontend callback URL with tokens

**Query Parameters (on redirect):**
| Parameter | Type | Description |
|-----------|------|-------------|
| `accessToken` | string | JWT access token |
| `refreshToken` | string | JWT refresh token |

---

### User Routes

Base path: `/api/users`

---

#### 1. Refresh Access Token

Obtain a new access token using refresh token.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /api/users/refresh-token` |
| **Auth Required** | No |

**Request Body:**
```json
{
  "refreshToken": "string"
}
```

**Success Response (200):**
```json
{
  "status": true,
  "message": "Access token berhasil diperbarui",
  "accessToken": "string"
}
```

**Error Responses:**
- `400 Bad Request` - Refresh token not provided
- `401 Unauthorized` - Invalid or expired refresh token

---

#### 2. Get Current User Profile

Get the authenticated user's profile information.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /api/users/profile` |
| **Auth Required** | Yes |

**Success Response (200):**
```json
{
  "status": true,
  "message": "Success get current user",
  "data": {
    "id_user": "uuid",
    "name": "string",
    "email": "string",
    "image": "string | null",
    "poin": 0,
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

---

#### 3. Update User Profile

Update the authenticated user's profile (name and/or profile image).

| Property | Value |
|----------|-------|
| **Endpoint** | `PATCH /api/users/changeProfile` |
| **Auth Required** | Yes |
| **Content-Type** | `multipart/form-data` |

**Request Body (form-data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | New display name |
| `image` | file | No | Profile image file |

**Success Response (200):**
```json
{
  "status": true,
  "message": "Success update profile",
  "data": {
    "id_user": "uuid",
    "name": "string",
    "email": "string",
    "image": "string",
    "poin": 0,
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

---

#### 4. Logout

Invalidates the user's refresh token.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /api/users/logout` |
| **Auth Required** | Yes |

**Success Response (200):**
```json
{
  "status": true,
  "message": "Logout berhasil"
}
```

---

### Ulasan (Review) Routes

Base path: `/api/ulasan`

---

#### 1. Create Ulasan

Create a new review/ulasan with optional file attachments.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /api/ulasan/createUlasan` |
| **Auth Required** | Yes |
| **Content-Type** | `multipart/form-data` |

**Request Body (form-data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idMatkul` | string (uuid) | No | Subject ID |
| `idDosen` | string (uuid) | No | Lecturer ID |
| `idReply` | string (uuid) | No | Reply to review ID |
| `idForum` | string (uuid) | No | Forum ID |
| `judulUlasan` | string | Yes | Review title |
| `textUlasan` | string | Yes | Review body text |
| `files` | file[] | No | Attachment files (multiple) |

**Success Response (200):**
```json
{
  "status": true,
  "message": "Success get all ulasan",
  "data": {
    "id_review": "uuid",
    "id_user": "uuid",
    "id_subject": "uuid | null",
    "id_lecturer": "uuid | null",
    "id_reply": "uuid | null",
    "id_forum": "uuid | null",
    "title": "string",
    "body": "string",
    "files": ["url1", "url2"],
    "vectorize": "vector",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

---

#### 2. Edit Ulasan

Edit an existing review (owner only).

| Property | Value |
|----------|-------|
| **Endpoint** | `PATCH /api/ulasan/editUlasan` |
| **Auth Required** | Yes |
| **Content-Type** | `multipart/form-data` |

**Request Body (form-data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id_review` | string (uuid) | Yes | Review ID to edit |
| `title` | string | No | New title |
| `body` | string | No | New body text |
| `files` | file[] | No | New attachment files |

**Success Response (200):**
```json
{
  "status": true,
  "message": "Success update ulasan",
  "data": {
    "id_review": "uuid",
    "id_user": "uuid",
    "title": "string",
    "body": "string",
    "files": ["url1", "url2"],
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

---

#### 3. Get All Ulasan

Retrieve all reviews.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /api/ulasan/getUlasan` |
| **Auth Required** | Yes |

**Success Response (200):**
```json
{
  "status": true,
  "message": "Success get all ulasan",
  "data": [
    {
      "id_review": "uuid",
      "id_user": "uuid",
      "id_subject": "uuid | null",
      "id_lecturer": "uuid | null",
      "title": "string",
      "body": "string",
      "files": ["url1", "url2"],
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ]
}
```

---

#### 4. Search Similar Ulasan

Search for semantically similar reviews using vector similarity.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /api/ulasan/search` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
  "query": "string",
  "limit": 5
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | - | Search query text |
| `limit` | number | No | 5 | Maximum results to return |

**Success Response (200):**
```json
{
  "status": true,
  "message": "Pencarian berhasil",
  "data": {
    "query": "string",
    "count": 5,
    "results": [
      {
        "id_review": "uuid",
        "id_user": "uuid",
        "id_subject": "uuid",
        "id_lecturer": "uuid",
        "title": "string",
        "files": ["url1"],
        "created_at": "timestamp",
        "distance": 0.123,
        "similarity": 0.877
      }
    ]
  }
}
```

---

#### 5. Like Ulasan

Like a review.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /api/ulasan/likeUlasan` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
  "id_review": "uuid"
}
```

**Success Response (200):**
```json
{
  "status": true,
  "message": "Success like ulasan",
  "data": {
    "id_like": "uuid",
    "id_user": "uuid",
    "id_review": "uuid"
  }
}
```

**Error Response:**
- `400 Bad Request` - User already liked this review

---

#### 6. Unlike Ulasan

Remove like from a review.

| Property | Value |
|----------|-------|
| **Endpoint** | `DELETE /api/ulasan/likeUlasan` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
  "id_review": "uuid"
}
```

**Success Response (200):**
```json
{
  "status": true,
  "message": "Success unlike ulasan",
  "data": {
    "id_like": "uuid",
    "id_user": "uuid",
    "id_review": "uuid"
  }
}
```

---

#### 7. Get Liked Ulasan

Get all reviews liked by the authenticated user.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /api/ulasan/likeUlasan` |
| **Auth Required** | Yes |

**Success Response (200):**
```json
{
  "status": true,
  "message": "Success get all ulasan",
  "data": [
    {
      "id_review": "uuid",
      "id_user": "uuid",
      "title": "string",
      "body": "string",
      "files": ["url1"],
      "created_at": "timestamp"
    }
  ]
}
```

---

#### 8. Bookmark Ulasan

Bookmark a review.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /api/ulasan/bookmarkUlasan` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
  "id_review": "uuid"
}
```

**Success Response (200):**
```json
{
  "status": true,
  "message": "Success repost ulasan",
  "data": {
    "id_bookmark": "uuid",
    "id_user": "uuid",
    "id_review": "uuid"
  }
}
```

---

#### 9. Remove Bookmark

Remove bookmark from a review.

| Property | Value |
|----------|-------|
| **Endpoint** | `DELETE /api/ulasan/bookmarkUlasan` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
  "id_review": "uuid"
}
```

**Success Response (200):**
```json
{
  "status": true,
  "message": "Success unlike ulasan",
  "data": {
    "id_bookmark": "uuid",
    "id_user": "uuid",
    "id_review": "uuid"
  }
}
```

---

#### 10. Get Bookmarked Ulasan

Get all reviews bookmarked by the authenticated user.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /api/ulasan/bookmarkUlasan` |
| **Auth Required** | Yes |

**Success Response (200):**
```json
{
  "status": true,
  "message": "Success get all ulasan",
  "data": [
    {
      "id_review": "uuid",
      "id_user": "uuid",
      "title": "string",
      "body": "string",
      "files": ["url1"],
      "created_at": "timestamp"
    }
  ]
}
```

---

### Forum Routes

Base path: `/api/forum`

---

#### 1. Create Forum

Create a new forum for a subject.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /api/forum/createForum` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "id_subject": "uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Forum title |
| `description` | string | No | Forum description |
| `id_subject` | uuid | Yes | Subject ID |

**Success Response (201):**
```json
{
  "success": true,
  "message": "Forum created successfully",
  "data": {
    "id_forum": "uuid",
    "id_user": "uuid",
    "id_subject": "uuid",
    "title": "string",
    "description": "string",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

---

#### 2. Get Forums by Subject

Get all forums for a specific subject.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /api/forum/getForums` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
  "id_subject": "uuid"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Success get all forums",
  "data": [
    {
      "id_forum": "uuid",
      "id_user": "uuid",
      "id_subject": "uuid",
      "title": "string",
      "description": "string",
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ]
}
```

---

### Report Routes

Base path: `/api/reports`

---

#### 1. Create Report

Submit a report for a review or lecturer.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /api/reports/createReport` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
  "id_review": "uuid",
  "id_lecturer": "uuid",
  "type": "report_type",
  "body": "string"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id_review` | uuid | No* | Review ID to report |
| `id_lecturer` | uuid | No* | Lecturer ID to report |
| `type` | string | Yes | Report type (see below) |
| `body` | string | No | Report description |

*Either `id_review` or `id_lecturer` must be provided.

**Report Types:**
- `Hate`
- `Abuse & Harassment`
- `Violent Speech`
- `Privacy`
- `Spam`
- `Violent & hateful entities`
- `Civic Integrity`
- `Other`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Report created successfully",
  "data": {
    "id_report": "uuid",
    "id_user": "uuid",
    "id_review": "uuid | null",
    "id_lecturer": "uuid | null",
    "type": "string",
    "body": "string",
    "status": "Pending",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

---

#### 2. Get User's Reports

Get all reports submitted by the authenticated user.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /api/reports/getReports` |
| **Auth Required** | Yes |

**Success Response (200):**
```json
{
  "success": true,
  "message": "Report created successfully",
  "data": [
    {
      "id_report": "uuid",
      "id_user": "uuid",
      "id_review": "uuid | null",
      "id_lecturer": "uuid | null",
      "type": "string",
      "body": "string",
      "status": "Pending",
      "created_at": "timestamp"
    }
  ]
}
```

**Report Status Values:**
- `Pending`
- `Reviewing`
- `Investigating`
- `Action`
- `Resolved`
- `Rejected`

---

### Chatbot Routes

Base path: `/api/chatbot`

---

#### 1. Ask Chatbot

Ask a question to the AI chatbot about a specific subject.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /api/chatbot/ask` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
  "question": "string",
  "id_subject": "uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | Yes | Question to ask |
| `id_subject` | uuid | Yes | Subject context ID |

**Success Response (200):**
```json
{
  "success": true,
  "message": "Success ask chatbot",
  "data": "AI generated answer based on reviews..."
}
```

---

#### 2. Get Chat History

Get the authenticated user's chatbot conversation history.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /api/chatbot/history` |
| **Auth Required** | Yes |

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id_chatbot": "uuid",
      "id_user": "uuid",
      "question": "string",
      "answer": "string",
      "created_at": "timestamp"
    }
  ]
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "status": false,
  "message": "Error description"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request - Invalid input |
| `401` | Unauthorized - Token not provided |
| `403` | Forbidden - Invalid/expired token |
| `404` | Not Found - Resource doesn't exist |
| `409` | Conflict - Resource already exists |
| `500` | Internal Server Error |

---

## Data Types

### UUID Format
All IDs use UUID v4 format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`

### Timestamp Format
ISO 8601 format with timezone: `2024-01-15T10:30:00.000Z`

### Faculty Enum
```
FIF | FRI | FTE | FIK | FIT | FKS | FEB
```

### Report Type Enum
```
Hate | Abuse & Harassment | Violent Speech | Privacy | Spam | Violent & hateful entities | Civic Integrity | Other
```

### Report Status Enum
```
Pending | Reviewing | Investigating | Action | Resolved | Rejected
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Access token secret |
| `JWT_REFRESH_SECRET` | Refresh token secret |
| `SESSION_SECRET` | Express session secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `FIREBASE_*` | Firebase configuration |
| `VOYAGE_API_KEY` | VoyageAI API key for embeddings |

---

## Rate Limiting

Currently, no rate limiting is implemented. Consider adding rate limiting for production deployments.

---

## CORS

CORS is enabled for all origins by default. Configure according to your production requirements.

---

*Last updated: December 2024*

