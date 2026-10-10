const API_URL = 'https://jsonplaceholder.typicode.com/posts';

const loadButton = document.querySelector('#load-btn');
const statusMessage = document.querySelector('#status');
const noteForm = document.querySelector('#note-form');
const titleInput = document.querySelector('#title-input');
const bodyInput = document.querySelector('#body-input');
const submitButton = document.querySelector('#submit-btn');
const notesList = document.querySelector('#notes-list');

let notes = [];

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const details = await response.json();
      if (typeof details.message === 'string') message = details.message;
      else if (typeof details.error === 'string') message = details.error;
    } catch {
      // Keep the HTTP status message when the server has no JSON error body.
    }
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function getNotes() {
  return request(`${API_URL}?_limit=10`);
}

async function createNote(note) {
  return request(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(note)
  });
}

async function deleteNote(noteId) {
  return request(`${API_URL}/${encodeURIComponent(noteId)}`, { method: 'DELETE' });
}

function setStatus(message, state = '') {
  statusMessage.textContent = message;
  statusMessage.className = `status${state ? ` status-${state}` : ''}`;
}

function setButtonsDisabled(disabled) {
  loadButton.disabled = disabled;
  submitButton.disabled = disabled;
  notesList.querySelectorAll('.delete-btn').forEach((button) => {
    button.disabled = disabled;
  });
}

function renderNotes() {
  notesList.replaceChildren();
  for (const note of notes) {
    const item = document.createElement('li');
    item.className = 'note-item';

    const content = document.createElement('div');
    content.className = 'note-content';

    const title = document.createElement('h3');
    title.textContent = note.title;
    content.append(title);

    const body = document.createElement('p');
    body.className = 'note-body';
    body.textContent = note.body || 'No additional detail.';
    content.append(body);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', 'Delete note');
    deleteButton.dataset.noteId = String(note.id);
    deleteButton.disabled = loadButton.disabled || submitButton.disabled;

    item.append(content, deleteButton);
    notesList.append(item);
  }
}

loadButton.addEventListener('click', async () => {
  setButtonsDisabled(true);
  setStatus('Loading notes…', 'loading');
  try {
    const result = await getNotes();
    notes = Array.isArray(result) ? result.slice(0, 10) : [];
    renderNotes();
    if (notes.length === 0) {
      setStatus('No notes yet. Create one to get started.', 'empty');
    } else {
      setStatus(`Loaded ${notes.length} notes.`, 'success');
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not load notes. Please try again.', 'error');
  } finally {
    setButtonsDisabled(false);
  }
});

noteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title) {
    setStatus('A title is required.', 'error');
    titleInput.focus();
    return;
  }
  if (title.length > 100) {
    setStatus('Keep the title to 100 characters or fewer.', 'error');
    titleInput.focus();
    return;
  }

  setButtonsDisabled(true);
  setStatus('Saving your note…', 'loading');
  try {
    const created = await createNote({ title, body, userId: 1 });
    notes = [{ ...created, title, body }, ...notes].slice(0, 10);
    renderNotes();
    noteForm.reset();
    setStatus('Note saved.', 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not save your note. Please try again.', 'error');
  } finally {
    setButtonsDisabled(false);
  }
});

notesList.addEventListener('click', async (event) => {
  const button = event.target.closest('.delete-btn');
  if (!button || button.disabled) return;

  const noteId = button.dataset.noteId;
  setButtonsDisabled(true);
  setStatus('Deleting note…', 'loading');
  try {
    await deleteNote(noteId);
    notes = notes.filter((note) => String(note.id) !== noteId);
    renderNotes();
    setStatus(notes.length ? 'Note deleted.' : 'No notes yet. Create one to get started.', notes.length ? 'success' : 'empty');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not delete the note. Please try again.', 'error');
  } finally {
    setButtonsDisabled(false);
  }
});