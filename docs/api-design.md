# QuickNotes API Design

This document specifies the production QuickNotes backend API; it is independent of the JSONPlaceholder demo client. Base URL: `https://api.quicknotes.example/v1`. All request and response bodies use JSON. Authenticated routes use a bearer access token, and timestamps are ISO 8601 UTC.

The server derives the user identity from the validated token. Clients must not send or choose an owner `userId` when creating or changing notes or tags. Notes have a required, trimmed title of 1-100 characters and an optional body (empty when omitted); the API rejects oversized bodies with `400 Bad Request`.

## Endpoints

| Method | Path | Description | Success status |
| --- | --- | --- | --- |
| `POST` | `/auth/session` | Authenticate a user and issue an access token. | `200 OK` |
| `GET` | `/notes` | List the authenticated user's notes; supports `limit`, `cursor`, and `tag` filters. | `200 OK` |
| `POST` | `/notes` | Create a note owned by the authenticated user. | `201 Created` |
| `GET` | `/notes/{noteId}` | Fetch one note the user is allowed to view. | `200 OK` |
| `PATCH` | `/notes/{noteId}` | Update supplied note fields without replacing omitted fields. | `200 OK` |
| `DELETE` | `/notes/{noteId}` | Delete a note and its tag links. | `204 No Content` |
| `GET` | `/tags` | List the authenticated user's tags. | `200 OK` |
| `POST` | `/tags` | Create a tag for the authenticated user. | `201 Created` |
| `PUT` | `/notes/{noteId}/tags/{tagId}` | Attach an existing tag to a note; safe to retry. | `204 No Content` |
| `DELETE` | `/notes/{noteId}/tags/{tagId}` | Remove a tag association without deleting the tag or note. | `204 No Content` |

List and detail responses include only the caller's authorized data. A note ID belonging to another user is treated as not found (`404`) to avoid disclosing its existence. List results are ordered by `updatedAt` descending, then `id` descending, and use cursor pagination to avoid unstable large offsets. `limit` defaults to 20 and is constrained to 1-100; `cursor` is an opaque server-generated token. `tag` filters by the user's tag name.

## Authentication

`POST /v1/auth/session` accepts credentials over HTTPS and returns a short-lived bearer token. The client stores and sends the token in the `Authorization` header for protected endpoints.

```http
POST /v1/auth/session
Content-Type: application/json
```

```json
{
  "email": "alex@example.com",
  "password": "<user-supplied-password>"
}
```

Response: `200 OK`.

```json
{
  "accessToken": "<signed-access-token>",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": { "id": 73, "email": "alex@example.com", "displayName": "Alex" }
}
```

## Create a note

Request:

```http
POST /v1/notes
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "title": "Release checklist",
  "body": "Confirm the migration and notify support.",
  "tagIds": [12, 18]
}
```

`title` is required; `body` and `tagIds` are optional. Ownership is taken from the bearer token, not from the request body. A tag ID that is missing or belongs to another user causes the whole create request to fail without creating a partial note.

Response: `201 Created`, with `Location: /v1/notes/481`.

```json
{
  "id": 481,
  "userId": 73,
  "title": "Release checklist",
  "body": "Confirm the migration and notify support.",
  "tags": [{ "id": 12, "name": "work" }, { "id": 18, "name": "release" }],
  "createdAt": "2026-10-10T09:30:00Z",
  "updatedAt": "2026-10-10T09:30:00Z"
}
```

## Tag operations

Create a tag with `POST /v1/tags` and a JSON body such as `{ "name": "work" }`; the response is `201 Created` with the new tag's `id`, `name`, and `createdAt`. Tag names are unique per user. Attach and detach tags with the `PUT` and `DELETE` association endpoints in the table; both return `204 No Content` when the requested state has been applied.

## List notes

Request: `GET /v1/notes?limit=2&cursor=eyJpZCI6NDgwfQ` with a bearer token.

Response: `200 OK`.

```json
{
  "items": [
    {
      "id": 481,
      "userId": 73,
      "title": "Release checklist",
      "body": "Confirm the migration and notify support.",
      "tags": [{ "id": 12, "name": "work" }],
      "createdAt": "2026-10-10T09:30:00Z",
      "updatedAt": "2026-10-10T09:30:00Z"
    },
    {
      "id": 476,
      "userId": 73,
      "title": "Ideas for Friday",
      "body": "Try a shorter review meeting.",
      "tags": [],
      "createdAt": "2026-10-09T15:05:00Z",
      "updatedAt": "2026-10-09T15:05:00Z"
    }
  ],
  "nextCursor": "eyJpZCI6NDc2fQ"
}
```

An empty collection returns `200 OK` with `"items": []` and `"nextCursor": null`. Clients should follow the returned cursor rather than constructing one themselves.

## Errors

Errors use a consistent JSON envelope. Validation errors may include field-specific details.

| Status | Meaning |
| --- | --- |
| `400 Bad Request` | Malformed JSON, invalid fields, or invalid pagination. |
| `401 Unauthorized` | Missing, expired, or invalid access token. |
| `403 Forbidden` | Authenticated caller lacks permission for the resource. |
| `404 Not Found` | Note or tag does not exist, or is not visible to this caller. |
| `409 Conflict` | Unique constraint or conflicting resource state. |
| `429 Too Many Requests` | Rate limit exceeded; includes `Retry-After`. |
| `500 Internal Server Error` | Unexpected server failure. |
| `503 Service Unavailable` | Service is temporarily unavailable. |

Example `400 Bad Request`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [{ "field": "title", "issue": "Title is required and must be at most 100 characters." }],
    "requestId": "req_01J9QK7M3A"
  }
}
```

Every error response uses this envelope and includes a request ID for support and tracing. Never return stack traces, database errors, passwords, or access tokens in an error body. `401` means authentication is absent or invalid; `403` means an authenticated user is denied a known operation; private note/tag lookups may use `404` to avoid leaking another user's resource existence.