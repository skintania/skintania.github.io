# Complete Backend API Specifications for SkIntania

This document outlines **ALL** required API endpoints for the SkIntania application to function properly. Please implement these in your Cloudflare Workers backend.

## Authentication & Security
All authenticated endpoints require `Authorization: Bearer <token>` header.

---

## 🔐 1. AUTHENTICATION APIs

### POST /auth/login
User login endpoint.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "username": "username",
  "role": "user"
}
```

**Error Responses:**
- 401: Invalid credentials
- 403: Account not verified (OTP required)
- 429: Too many attempts

### POST /auth/register
User registration endpoint.

**Request Body:**
```json
{
  "firstname": "John",
  "lastname": "Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123",
  "osk_gen": 143,
  "osk_id": "51234",
  "student_id": "6832212345"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please verify your email."
}
```

**Error Responses:**
- 400: Validation errors
- 409: Username/email already exists

### POST /auth/verify-otp
Verify email with OTP code.

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "username": "username",
  "role": "user"
}
```

### POST /auth/resend-otp
Resend OTP to email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

### POST /auth/forgot-password
Request password reset.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

### POST /auth/reset-password
Reset password with token.

**Request Body:**
```json
{
  "token": "reset_token",
  "password": "new_password"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### GET /auth/status
Check authentication status and server security settings.

**Response:**
```json
{
  "requireAuth": true,
  "role": "user"
}
```

---

## 👤 2. USER MANAGEMENT APIs

### GET /user/profile
Get current user profile data.

**Success Response (200):**
```json
{
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "firstname": "John",
    "lastname": "Doe",
    "osk_gen": 143,
    "osk_id": "51234",
    "student_id": "6832212345",
    "profile_url": "/uploads/avatar1.png",
    "is_verified": 1,
    "created_at": "2023-01-01T00:00:00Z"
  }
}
```

**Error Responses:**
- 401: Not authenticated
- 404: User not found

### PUT /user/profile
Update user profile.

**Request Body:**
```json
{
  "firstname": "John",
  "lastname": "Doe",
  "osk_gen": 143,
  "osk_id": "51234",
  "student_id": "6832212345"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

### POST /user/change-password
Change user password.

**Request Body:**
```json
{
  "current_password": "old_password",
  "new_password": "new_password"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### DELETE /user/delete-account
Delete user account (requires password confirmation).

**Request Body:**
```json
{
  "password": "current_password"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

---

## 🛡️ 3. ADMIN PANEL APIs

### GET /admin/stats
Returns system statistics (Admin only).

**Success Response (200):**
```json
{
  "total_users": 150,
  "verified_users": 120,
  "storage_used": "2.5 GB"
}
```

**Error Responses:**
- 401: Not authenticated
- 403: Not admin

### GET /admin/users
Returns list of all users (Admin only).

**Success Response (200):**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "username": "user1",
      "email": "user1@example.com",
      "osk_gen": "Gen 1",
      "role": "user",
      "is_banned": 0,
      "firstname": "John",
      "lastname": "Doe",
      "osk_id": "12345",
      "student_id": "67890",
      "is_verified": 1,
      "created_at": "2023-01-01T00:00:00Z",
      "profile_url": "/uploads/avatar1.png"
    }
  ]
}
```

### POST /admin/users/{id}/ban
Ban a user (Admin only).

**Success Response (200):**
```json
{
  "success": true,
  "message": "User banned successfully"
}
```

### POST /admin/users/{id}/unban
Unban a user (Admin only).

**Success Response (200):**
```json
{
  "success": true,
  "message": "User unbanned successfully"
}
```

### GET /admin/logs
Returns system logs (Admin only).

**Success Response (200):**
```json
{
  "logs": [
    {
      "type": "info",
      "timestamp": "2023-01-01T10:00:00Z",
      "message": "User logged in"
    },
    {
      "type": "error",
      "timestamp": "2023-01-01T10:05:00Z",
      "message": "Database connection failed"
    }
  ]
}
```

### POST /admin/r2/upload
Upload file to R2 storage (Admin only).

**Content-Type:** multipart/form-data
**Body:** FormData with 'file' field

**Success Response (200):**
```json
{
  "success": true,
  "message": "File uploaded successfully"
}
```

### GET /admin/r2/files
List files in R2 storage (Admin only).

**Success Response (200):**
```json
{
  "files": [
    {
      "name": "avatar_user99.png",
      "size": "1.2 MB",
      "url": "https://storage.example.com/avatar_user99.png"
    }
  ]
}
```

### POST /admin/r2/delete
Delete file from R2 storage (Admin only).

**Request Body:**
```json
{
  "filename": "avatar_user99.png"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

### POST /admin/d1/query
Execute SQL query on D1 database (Admin only).

**Request Body:**
```json
{
  "query": "SELECT * FROM users LIMIT 10"
}
```

**Response (SELECT queries):**
```json
{
  "results": [
    {"id": 1, "username": "user1", "email": "user1@example.com"}
  ]
}
```

**Response (Non-SELECT queries):**
```json
{
  "results": []
}
```

**Error Response:**
```json
{
  "error": "SQL syntax error"
}
```

---

## 📁 4. FILE STORAGE APIs (SKDrive)

### GET /skdrive
List files and folders in SKDrive.

**Query Parameters:**
- `path`: Folder path (optional)

**Success Response (200):**
```json
[
  {
    "name": "Physics",
    "type": "folder",
    "path": "Physics/",
    "size": null
  },
  {
    "name": "document.pdf",
    "type": "file",
    "path": "document.pdf",
    "size": "2.5 MB",
    "url": "https://storage.example.com/document.pdf"
  }
]
```

**Error Responses:**
- 401: Not authenticated
- 403: Access denied

---

## 📊 5. CALCULATOR APIs

### GET /asset
Serve static asset files (JSON data files).

**Query Parameters:**
- `file`: File path (e.g., "Calculator/weight.json")

**Success Response (200):**
Returns the requested file content.

**Example:** `/asset?file=Calculator/weight.json`

---

## 📅 6. EVENT APIs

### GET /event/all
Get all events.

**Success Response (200):**
```json
{
  "events": [
    {
      "id": 1,
      "title": "OSK Meeting",
      "description": "Monthly meeting",
      "date": "2024-01-15",
      "time": "14:00",
      "location": "Room 101",
      "type": "meeting",
      "created_by": "admin",
      "created_at": "2024-01-01T10:00:00Z",
      "attendees": ["user1", "user2"],
      "polls": []
    }
  ]
}
```

### POST /event/create
Create new event.

**Content-Type:** multipart/form-data
**Body:** FormData with event data and optional images

**Success Response (201):**
```json
{
  "success": true,
  "message": "Event created successfully",
  "event_id": 1
}
```

### POST /event/edit
Edit existing event.

**Content-Type:** multipart/form-data
**Body:** FormData with updated event data

**Success Response (200):**
```json
{
  "success": true,
  "message": "Event updated successfully"
}
```

### POST /event/delete
Delete event (Creator or Admin only).

**Request Body:**
```json
{
  "event_id": 1
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

### POST /event/join
Join event.

**Request Body:**
```json
{
  "event_id": 1
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Joined event successfully"
}
```

### POST /event/vote
Vote in event poll.

**Request Body:**
```json
{
  "event_id": 1,
  "poll_id": 1,
  "choice_id": 2
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Vote recorded successfully"
}
```

---

## 📋 7. IMPLEMENTATION NOTES

### Authentication
- All endpoints except `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, and `/auth/verify-otp` require authentication
- Admin-only endpoints: All `/admin/*` routes
- Use JWT tokens for authentication

### Error Handling
- Return appropriate HTTP status codes
- Include error messages in response body
- Log security-related events

### File Uploads
- Validate file types and sizes
- Store files securely in R2
- Generate secure URLs for file access

### Database
- Use D1 for relational data
- Implement proper data validation
- Use prepared statements for SQL queries

### Security
- Rate limiting on auth endpoints
- Input validation and sanitization
- CORS configuration for frontend domain
- Secure file upload handling

### Performance
- Implement caching where appropriate
- Optimize database queries
- Use CDN for static assets

---

## 🚀 8. DEPLOYMENT CHECKLIST

- [ ] All endpoints implemented
- [ ] Authentication working
- [ ] File uploads functional
- [ ] Admin panel accessible
- [ ] Event system working
- [ ] Calculator data loading
- [ ] SKDrive file access
- [ ] Error handling implemented
- [ ] Security measures in place
- [ ] Performance optimized

This comprehensive API specification covers all functionality required for the SkIntania application.