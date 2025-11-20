# Utils - Handler Documentation

Dokumentasi lengkap untuk response handler, async handler, dan error handler.

## 1. Response Handler

Standardisasi format response API untuk konsistensi.

### Import

```javascript
import {
  successResponse,
  errorResponse,
  createdResponse,
  notFoundResponse,
  badRequestResponse,
  unauthorizedResponse,
  validationErrorResponse,
  paginationResponse
} from '../utils/responseHandler.js';
```

### Contoh Penggunaan

#### Success Response (200)

```javascript
// Controller example
export const getUsers = async (req, res) => {
  const users = await db.select().from(usersTable);
  return successResponse(res, 200, 'Users retrieved successfully', users);
};
```

#### Created Response (201)

```javascript
export const createUser = async (req, res) => {
  const newUser = await db.insert(usersTable).values(req.body).returning();
  return createdResponse(res, 'User created successfully', newUser);
};
```

#### Not Found Response (404)

```javascript
export const getUserById = async (req, res) => {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id));

  if (!user.length) {
    return notFoundResponse(res, 'User not found');
  }

  return successResponse(res, 200, 'User found', user[0]);
};
```

#### Validation Error Response (422)

```javascript
export const createUser = async (req, res) => {
  const errors = validateUserInput(req.body);

  if (errors.length > 0) {
    return validationErrorResponse(res, 'Validation failed', errors);
  }

  // Create user...
};
```

#### Pagination Response

```javascript
export const getUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const users = await db.select().from(usersTable).limit(limit).offset(offset);
  const totalItems = await db.select({ count: sql`COUNT(*)` }).from(usersTable);

  const totalPages = Math.ceil(totalItems[0].count / limit);

  return paginationResponse(
    res,
    200,
    'Users retrieved successfully',
    users,
    {
      page,
      limit,
      totalItems: totalItems[0].count,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  );
};
```

## 2. Async Handler

Wrapper untuk async functions yang otomatis menangkap error tanpa perlu try-catch di setiap route.

### Import

```javascript
import asyncHandler from '../utils/asyncHandler.js';
// atau
import { asyncHandler } from '../utils/asyncHandler.js';
```

### Contoh Penggunaan

#### Tanpa Async Handler (Traditional Way)

```javascript
router.get('/users', async (req, res, next) => {
  try {
    const users = await db.select().from(usersTable);
    return successResponse(res, 200, 'Success', users);
  } catch (error) {
    next(error);
  }
});
```

#### Dengan Async Handler (Clean Way)

```javascript
router.get('/users', asyncHandler(async (req, res) => {
  const users = await db.select().from(usersTable);
  return successResponse(res, 200, 'Success', users);
}));
```

#### Di Controller

```javascript
export const getUsers = asyncHandler(async (req, res) => {
  const users = await db.select().from(usersTable);
  return successResponse(res, 200, 'Users retrieved', users);
});

export const createUser = asyncHandler(async (req, res) => {
  const newUser = await db.insert(usersTable).values(req.body).returning();
  return createdResponse(res, 'User created', newUser[0]);
});
```

## 3. Custom Error Classes

Custom error classes untuk throw error yang lebih spesifik.

### Import

```javascript
import {
  AppError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError
} from '../utils/customError.js';
```

### Contoh Penggunaan

#### Not Found Error

```javascript
export const getUserById = asyncHandler(async (req, res) => {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id));

  if (!user.length) {
    throw new NotFoundError('User not found');
  }

  return successResponse(res, 200, 'User found', user[0]);
});
```

#### Bad Request Error

```javascript
export const createUser = asyncHandler(async (req, res) => {
  if (!req.body.email || !req.body.name) {
    throw new BadRequestError('Email and name are required');
  }

  // Create user...
});
```

#### Unauthorized Error

```javascript
export const protectedRoute = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Please login to access this resource');
  }

  // Continue...
});
```

#### Conflict Error (Duplicate)

```javascript
export const createUser = asyncHandler(async (req, res) => {
  const existingUser = await db.select().from(usersTable)
    .where(eq(usersTable.email, req.body.email));

  if (existingUser.length > 0) {
    throw new ConflictError('Email already registered');
  }

  // Create user...
});
```

#### Validation Error dengan Detail

```javascript
export const createUser = asyncHandler(async (req, res) => {
  const errors = [];

  if (!req.body.email) {
    errors.push({ field: 'email', message: 'Email is required' });
  }

  if (!req.body.name) {
    errors.push({ field: 'name', message: 'Name is required' });
  }

  if (errors.length > 0) {
    throw new ValidationError('Validation failed', errors);
  }

  // Create user...
});
```

#### Custom App Error

```javascript
export const processPayment = asyncHandler(async (req, res) => {
  const payment = await processPaymentGateway(req.body);

  if (!payment.success) {
    throw new AppError('Payment processing failed', 402);
  }

  return successResponse(res, 200, 'Payment successful', payment);
});
```

## 4. Error Handler Middleware

Error handler middleware sudah disetup di `app.js` dan akan otomatis menangkap semua error.

### Fitur Error Handler

- Menangkap semua error dari async routes
- Format error response yang konsisten
- Handle JWT errors (JsonWebTokenError, TokenExpiredError)
- Handle PostgreSQL errors (duplicate, foreign key, not null)
- Show stack trace di development mode
- Log error di console (development only)

### Error Response Format

```json
{
  "success": false,
  "message": "Error message here",
  "errors": {
    // Optional error details
  },
  "stack": "Error stack trace (development only)"
}
```

## Complete Example

### Route File

```javascript
import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse, createdResponse, notFoundResponse } from '../utils/responseHandler.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/customError.js';
import { db } from '../db/index.js';
import { users } from '../db/schema/example.schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

// GET all users
router.get('/', asyncHandler(async (req, res) => {
  const allUsers = await db.select().from(users);
  return successResponse(res, 200, 'Users retrieved successfully', allUsers);
}));

// GET user by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const user = await db.select().from(users)
    .where(eq(users.id, req.params.id));

  if (!user.length) {
    throw new NotFoundError('User not found');
  }

  return successResponse(res, 200, 'User found', user[0]);
}));

// CREATE user
router.post('/', asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  // Validation
  if (!name || !email) {
    throw new BadRequestError('Name and email are required');
  }

  // Check duplicate
  const existing = await db.select().from(users)
    .where(eq(users.email, email));

  if (existing.length > 0) {
    throw new ConflictError('Email already exists');
  }

  // Create user
  const newUser = await db.insert(users)
    .values({ name, email })
    .returning();

  return createdResponse(res, 'User created successfully', newUser[0]);
}));

// UPDATE user
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;

  // Check if user exists
  const existing = await db.select().from(users)
    .where(eq(users.id, id));

  if (!existing.length) {
    throw new NotFoundError('User not found');
  }

  // Update user
  const updated = await db.update(users)
    .set({ name, email, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  return successResponse(res, 200, 'User updated successfully', updated[0]);
}));

// DELETE user
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deleted = await db.delete(users)
    .where(eq(users.id, id))
    .returning();

  if (!deleted.length) {
    throw new NotFoundError('User not found');
  }

  return successResponse(res, 200, 'User deleted successfully');
}));

export default router;
```

## Best Practices

1. **Selalu gunakan asyncHandler** untuk async routes
2. **Throw custom errors** untuk error yang spesifik (NotFoundError, BadRequestError, dll)
3. **Gunakan response handlers** untuk konsistensi response format
4. **Jangan catch error manual** di controller, biarkan asyncHandler yang handle
5. **Validasi input** sebelum database operation
6. **Check duplicate** sebelum insert data

## Error Handler Flow

```
Route Handler (with asyncHandler)
    ↓
  Error occurs
    ↓
asyncHandler catches error
    ↓
Pass error to next(error)
    ↓
Error Handler Middleware
    ↓
Format & send error response
```
