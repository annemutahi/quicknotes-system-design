# QuickNotes API Design

Base URL: `https://api.quicknotes.example/v1`. All request and response bodies use JSON. Authenticated routes use a bearer access token; timestamps are ISO 8601 UTC.

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
| `PUT` | `/notes/{noteId}/tags/{tagId}` | Attach an existing tag to a note; safe to retry. | `204 No Content` |

List and detail responses include only the caller's authorized data. List results are ordered by `updatedAt` descending and use cursor pagination to avoid unstable large offsets.

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