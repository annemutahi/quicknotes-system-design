# QuickNotes Data Model

QuickNotes uses PostgreSQL. User-owned notes and tags have clear relational integrity requirements, and the application benefits from transactional note/tag updates, unique constraints, and flexible joins for search and filtering. A relational model fits these access patterns better than a document store; JSON can still be used at the API boundary.

## Entities and relationships

- `users`: one user can own many notes and many tags (`users` to `notes` and `users` to `tags` are one-to-many).
- `notes` and `tags`: a note can have many tags, and a tag can label many notes. `note_tags` is the join table that models this many-to-many relationship.
- User ownership is stored on both notes and tags. The composite foreign key in `note_tags` ensures a note cannot be linked to another user's tag.

## Tables

| Entity | Columns and types | Keys |
| --- | --- | --- |
| `users` | `id BIGINT`, `email VARCHAR(320)`, `display_name VARCHAR(100)`, `password_hash TEXT`, `created_at TIMESTAMPTZ` | PK `id`; unique `email` |
| `notes` | `id BIGINT`, `user_id BIGINT`, `title VARCHAR(100)`, `body TEXT`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ` | PK `id`; FK `user_id` → `users.id` |
| `tags` | `id BIGINT`, `user_id BIGINT`, `name VARCHAR(50)`, `created_at TIMESTAMPTZ` | PK `id`; FK `user_id` → `users.id`; unique (`user_id`, `name`) |
| `note_tags` | `note_id BIGINT`, `tag_id BIGINT`, `user_id BIGINT`, `created_at TIMESTAMPTZ` | Composite PK (`note_id`, `tag_id`); composite FKs to notes and tags |

## PostgreSQL schema

```sql
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
    body TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, id)
);

CREATE TABLE tags (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name),
    UNIQUE (user_id, id)
);

CREATE TABLE note_tags (
    note_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (user_id, note_id) REFERENCES notes(user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, tag_id) REFERENCES tags(user_id, id) ON DELETE CASCADE
);
```

The redundant `user_id` in `note_tags` is intentional: the paired composite foreign keys enforce that both linked records have the same owner. The additional unique constraints on `(user_id, id)` provide referenced keys for those composite foreign keys.

## Example queries

Get a user's newest notes with cursor-friendly ordering:

```sql
SELECT id, title, body, created_at, updated_at
FROM notes
WHERE user_id = $1
ORDER BY updated_at DESC, id DESC
LIMIT $2;
```

Find notes with their tags (JOIN across all four entities):

```sql
SELECT n.id, n.title, t.name AS tag
FROM notes AS n
JOIN note_tags AS nt ON nt.user_id = n.user_id AND nt.note_id = n.id
JOIN tags AS t ON t.user_id = nt.user_id AND t.id = nt.tag_id
WHERE n.user_id = $1 AND t.name = $2
ORDER BY n.updated_at DESC;
```

Count notes per user, including users with no notes:

```sql
SELECT u.id, u.email, COUNT(n.id) AS note_count
FROM users AS u
LEFT JOIN notes AS n ON n.user_id = u.id
GROUP BY u.id, u.email
ORDER BY note_count DESC;
```

Create a note and attach a tag atomically:

```sql
BEGIN;
INSERT INTO notes (user_id, title, body)
VALUES ($1, $2, $3)
RETURNING id;
-- Use the returned note id below; both rows commit together.
INSERT INTO note_tags (user_id, note_id, tag_id)
VALUES ($1, $4, $5);
COMMIT;
```

## Index

```sql
CREATE INDEX idx_notes_user_updated_id
ON notes (user_id, updated_at DESC, id DESC);
```

This index supports the most common operation, retrieving one user's notes in newest-first order with a stable cursor, while avoiding a full scan and sort of other users' notes.