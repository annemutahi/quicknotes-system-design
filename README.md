# QuickNotes System Design

A small browser-based notes client paired with a REST API design, relational data model, and scalable service architecture. The client uses JSONPlaceholder so the UI can demonstrate GET, POST, and DELETE without a backend deployment.

## Run the API client

Open `index.html` in VS Code and choose **Open with Live Server** (or click **Go Live** in the status bar). Live Server opens the client at a local URL such as `http://127.0.0.1:5500/index.html`; use **Load notes** to fetch ten sample posts, then use the form to create a note or delete a displayed note.

If Live Server is not installed, install the **Live Server** extension by Ritwick Dey. Alternatively, from the project root, start Python's static server:

```powershell
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Live Server and Python serve only the static frontend; the client sends API requests to JSONPlaceholder. JSONPlaceholder simulates successful POST and DELETE responses but does not persist those changes; reloading restores its sample data. The design documents describe the production API rather than an implemented backend.

## Design documents

- [API design](docs/api-design.md)
- [Data model](docs/data-model.md)
- [Architecture](docs/architecture.md)

## What I learned

- A successful HTTP response is not the same as durable persistence; a mock API's limits should be visible to the user.
- Relational constraints can encode ownership invariants, not just connect records.
- Caches and read replicas improve read capacity, but consistency and invalidation need explicit policies.
- Keeping user-provided text in DOM text nodes avoids interpreting note content as markup.