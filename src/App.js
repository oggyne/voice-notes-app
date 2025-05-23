const { useState, useEffect } = React;
const { createRoot } = ReactDOM;

// Utility: Truncate text to ~150 chars without cutting words
const truncateText = (text, maxLength = 150) => {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  return slice.slice(0, lastSpace) + '...';
};

// Utility: Format ISO date to readable string
const formatDate = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// IndexedDB utilities
const getNotes = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('VoiceNotesDB', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore('notes', { keyPath: 'id' });
    };
    request.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const allNotes = store.getAll();
      allNotes.onsuccess = () => resolve(allNotes.result);
      allNotes.onerror = () => reject(allNotes.error);
    };
    request.onerror = () => reject(request.error);
  });
};

const saveNote = async (note) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('VoiceNotesDB', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore('notes', { keyPath: 'id' });
    };
    request.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      store.put(note);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
};

const deleteNote = async (id) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('VoiceNotesDB', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore('notes', { keyPath: 'id' });
    };
    request.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
};

const deleteAllNotes = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('VoiceNotesDB', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore('notes', { keyPath: 'id' });
    };
    request.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
};

// NoteList component
const NoteList = ({ notes, onView, onDelete }) => {
  return (
    <div className="space-y-2">
      {notes.length ? notes.map(note => (
        <div key={note.id} className="p-4 bg-gray-100 rounded-lg flex justify-between items-start">
          <div onClick={() => onView(note)} className="cursor-pointer">
            <p className="text-gray-800">{truncateText(note.text)}</p>
            <p className="text-sm text-gray-500">{formatDate(note.createdAt)}</p>
          </div>
          <button
            onClick={() => onDelete(note.id)}
            className="text-red-500 hover:text-red-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )) : <p className="text-gray-500">No notes yet.</p>}
    </div>
  );
};

// NoteForm component
const NoteForm = ({ onSubmit, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.lang = 'uk-UA';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = true; // Allow longer pauses
      setRecognition(rec);

      // Auto-start recording when component mounts
      if (!isRecording) {
        startRecording(rec);
      }
    } else {
      console.error('Web Speech API not supported in this browser.');
      alert('Speech recognition is not available.');
    }

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, []);

  const startRecording = (rec) => {
    if (!rec) return;
    setIsRecording(true);
    rec.start();
    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setIsRecording(false);
      rec.stop();
      onSubmit(transcript);
    };
    rec.onerror = (event) => {
      console.error('Recognition error:', event.error);
      setIsRecording(false);
      alert('Recognition error: ' + event.error);
    };
    rec.onend = () => {
      setIsRecording(false);
    };
  };

  const stopRecording = () => {
    if (recognition) {
      recognition.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex space-x-2">
      <button
        className={`px-4 py-2 rounded text-white ${isRecording ? 'bg-red-500' : 'bg-blue-500'}`}
        onClick={stopRecording}
        disabled={!isRecording}
      >
        {isRecording ? 'Stop Recording' : 'Recording...'}
      </button>
      <button
        className="px-4 py-2 bg-gray-500 text-white rounded"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
};

// NoteView component
const NoteView = ({ note, onSave, onCancel }) => {
  const [text, setText] = useState(note.text);

  const handleSave = () => {
    const updatedNote = {
      ...note,
      text
    };
    onSave(updatedNote);
  };

  return (
    <div className="space-y-4">
      <textarea
        className="w-full p-2 border rounded"
        rows="5"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex space-x-2">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded"
          onClick={handleSave}
        >
          Save
        </button>
        <button
          className="px-4 py-2 bg-gray-500 text-white rounded"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// DeleteAllDialog component
const DeleteAllDialog = ({ open, onClose, onConfirm }) => {
  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center ${open ? '' : 'hidden'}`}>
      <div className="bg-white p-6 rounded-lg max-w-sm w-full">
        <h3 className="text-lg font-bold mb-4">Delete All Notes?</h3>
        <p className="text-gray-600 mb-6">This will permanently delete all notes. Are you sure?</p>
        <div className="flex space-x-2">
          <button
            className="px-4 py-2 bg-gray-500 text-white rounded"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-red-500 text-white rounded"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// Main App component
const App = () => {
  const [notes, setNotes] = useState([]);
  const [currentScreen, setCurrentScreen] = useState('list');
  const [selectedNote, setSelectedNote] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  useEffect(() => {
    const loadNotes = async () => {
      try {
        const storedNotes = await getNotes();
        setNotes(storedNotes);
      } catch (error) {
        console.error('Error loading notes:', error);
      }
    };
    loadNotes();
  }, []);

  const handleNewNote = async (transcript) => {
    if (!transcript) return;
    const note = {
      id: crypto.randomUUID(),
      text: transcript,
      createdAt: new Date().toISOString()
    };
    try {
      await saveNote(note);
      setNotes([...notes, note]);
      setCurrentScreen('list');
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteNote(id);
      setNotes(notes.filter(note => note.id !== id));
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAllNotes();
      setNotes([]);
      setDeleteAllOpen(false);
    } catch (error) {
      console.error('Error deleting all notes:', error);
      alert('Failed to delete all notes.');
    }
  };

  const handleView = (note) => {
    setSelectedNote(note);
    setCurrentScreen('view');
  };

  const handleSaveNote = async (updatedNote) => {
    try {
      await saveNote(updatedNote);
      setNotes(notes.map(note => note.id === updatedNote.id ? updatedNote : note));
      setCurrentScreen('list');
      setSelectedNote(null);
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note.');
    }
  };

  // Filter notes by search
  const filteredNotes = notes.filter(note => 
    !searchText || note.text.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Voice Notes</h1>
      {currentScreen === 'list' ? (
        <>
          <div className="mb-4">
            <input
              className="w-full p-2 border rounded"
              placeholder="Search notes..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          <NoteList notes={filteredNotes} onView={handleView} onDelete={handleDelete} />
          <div className="mt-4 flex space-x-2">
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded"
              onClick={() => setCurrentScreen('form')}
            >
              New Note
            </button>
            <button
              className={`px-4 py-2 rounded ${notes.length ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              onClick={() => setDeleteAllOpen(true)}
              disabled={!notes.length}
            >
              Delete All Notes
            </button>
          </div>
          <DeleteAllDialog
            open={deleteAllOpen}
            onClose={() => setDeleteAllOpen(false)}
            onConfirm={handleDeleteAll}
          />
        </>
      ) : currentScreen === 'form' ? (
        <NoteForm
          onSubmit={handleNewNote}
          onCancel={() => setCurrentScreen('list')}
        />
      ) : (
        <NoteView
          note={selectedNote}
          onSave={handleSaveNote}
          onCancel={() => setCurrentScreen('list')}
        />
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);