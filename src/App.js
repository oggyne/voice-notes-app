const { useState, useEffect, useRef } = React;
const { createRoot } = ReactDOM;

// Utility: Truncate text to ~150 chars without cutting words
const truncateText = (text, maxLength = 150) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice) + '...';
};

// Auto title: first sentence, otherwise first ~8 words, max ~56 chars
const makeTitle = (text, maxLength = 56) => {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Нотатка';
  const sentence = cleaned.match(/^[^.!?…]+[.!?…]?/);
  let phrase = (sentence ? sentence[0] : cleaned).replace(/[.!?…]+$/, '').trim();
  if (phrase.length <= maxLength) {
    const words = phrase.split(' ');
    if (words.length > 8) phrase = words.slice(0, 8).join(' ');
    return phrase;
  }
  const slice = phrase.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 20 ? slice.slice(0, lastSpace) : slice).trim();
};

const noteTitle = (note) => (note && note.title && note.title.trim()) || makeTitle(note && note.text);

const SUMMARIZER_OPTIONS = {
  type: 'headline',
  format: 'plain-text',
  length: 'short',
  sharedContext:
    'Personal voice notes, often in Ukrainian. Write a short topical headline that says what the note is about, in the same language as the note.',
};

let summarizerPromise = null;

const ensureSummarizer = () => {
  if (!('Summarizer' in self)) return Promise.resolve(null);
  if (!summarizerPromise) {
    summarizerPromise = (async () => {
      const tryCreate = async (options) => {
        const availability = await Summarizer.availability(options);
        if (availability === 'unavailable') return null;
        return Summarizer.create({
          ...options,
          monitor(m) {
            m.addEventListener('downloadprogress', () => {});
          }
        });
      };
      try {
        const withLang = await tryCreate({
          ...SUMMARIZER_OPTIONS,
          expectedInputLanguages: ['uk', 'en'],
          outputLanguage: 'uk'
        });
        if (withLang) return withLang;
      } catch (err) {
        console.warn('Summarizer with uk locale failed:', err);
      }
      try {
        return await tryCreate(SUMMARIZER_OPTIONS);
      } catch (err) {
        console.warn('Summarizer unavailable:', err);
        summarizerPromise = null;
        return null;
      }
    })();
  }
  return summarizerPromise;
};

const cleanHeadline = (raw) => {
  let t = String(raw || '')
    .replace(/^#+\s*/, '')
    .replace(/[*_`]/g, '')
    .replace(/^["«“']+|["»”']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > 80) {
    const slice = t.slice(0, 80);
    const lastSpace = slice.lastIndexOf(' ');
    t = (lastSpace > 30 ? slice.slice(0, lastSpace) : slice).trim();
  }
  return t;
};

const summarizeTitle = async (text) => {
  const fallback = makeTitle(text);
  try {
    const summarizer = await ensureSummarizer();
    if (!summarizer) return fallback;
    const summary = await summarizer.summarize(text, {
      context: 'Short title so the user can recognize this note in a list.'
    });
    return cleanHeadline(summary) || fallback;
  } catch (err) {
    console.warn('summarizeTitle failed:', err);
    return fallback;
  }
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

const SWIPE_HINT = 80;
const SWIPE_DELETE = 160;

const formatNoteForCopy = (note) =>
  [noteTitle(note), note.text || '', formatDate(note.createdAt)].join('\n');

const NoteItem = ({ note, onDelete, selecting, selected, onToggleSelect }) => {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const mode = useRef('undecided');
  const offsetRef = useRef(0);
  const rootRef = useRef(null);

  const setOff = (value) => {
    offsetRef.current = value;
    setOffset(value);
  };

  useEffect(() => {
    if (selecting) setOff(0);
  }, [selecting]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onTouchMove = (event) => {
      if (mode.current === 'h') event.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  const onPointerDown = (event) => {
    startX.current = event.clientX;
    startY.current = event.clientY;
    startOffset.current = offsetRef.current;
    mode.current = 'undecided';
    if (!selecting) setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (selecting) return;
    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;
    if (mode.current === 'undecided') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      mode.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (mode.current === 'v') setDragging(false);
    }
    if (mode.current !== 'h') return;
    setOff(Math.min(0, startOffset.current + dx));
  };

  const onPointerUp = (event) => {
    setDragging(false);
    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;
    const tapped = Math.abs(dx) < 8 && Math.abs(dy) < 8;
    if (selecting) {
      if (tapped) onToggleSelect(note.id);
      mode.current = 'undecided';
      return;
    }
    if (mode.current === 'h') {
      const x = offsetRef.current;
      if (x <= -SWIPE_DELETE) {
        onDelete(note.id);
        return;
      }
      if (x <= -SWIPE_HINT) {
        setOff(-SWIPE_HINT);
      } else {
        setOff(0);
      }
    } else if (tapped) {
      if (offsetRef.current < 0) {
        setOff(0);
      } else {
        setOpen((value) => !value);
      }
    }
    mode.current = 'undecided';
  };

  return (
    <div ref={rootRef} className="relative overflow-hidden rounded-lg">
      <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-4">
        <span className="text-white font-semibold">
          {offset <= -SWIPE_DELETE ? 'Release to delete' : 'Delete'}
        </span>
      </div>
      <div
        className={`relative p-4 select-none ${selected ? 'bg-blue-100' : 'bg-gray-100'}`}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 0.2s ease-out',
          touchAction: 'pan-y'
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="flex items-start">
          {selecting ? (
            <div className={`mt-1 mr-3 w-5 h-5 rounded border flex-shrink-0 ${selected ? 'bg-blue-500 border-blue-500' : 'border-gray-400 bg-white'}`} />
          ) : null}
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 font-semibold">{noteTitle(note)}</p>
            <p className="text-sm text-gray-500 mt-1">{formatDate(note.createdAt)}</p>
            {open ? (
              <p className="text-gray-800 text-sm mt-3 whitespace-pre-wrap">{note.text}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const NoteList = ({ notes, onDelete, selecting, selectedIds, onToggleSelect }) => {
  return (
    <div className="space-y-2">
      {notes.length ? notes.map(note => (
        <NoteItem
          key={note.id}
          note={note}
          onDelete={onDelete}
          selecting={selecting}
          selected={!!selectedIds[note.id]}
          onToggleSelect={onToggleSelect}
        />
      )) : <p className="text-gray-500">No notes yet.</p>}
    </div>
  );
};

const joinTranscript = (...parts) =>
  parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

const normalizeWords = (text) => (text || '').replace(/\s+/g, ' ').trim();

const mergeTranscript = (prev, next) => {
  const a = normalizeWords(prev);
  const b = normalizeWords(next);
  if (!b) return a;
  if (!a) return b;
  if (a === b || a.endsWith(b)) return a;
  if (b.startsWith(a) || (b.includes(a) && b.length > a.length)) return b;
  const aWords = a.split(' ');
  const bWords = b.split(' ');
  let overlap = 0;
  const max = Math.min(aWords.length, bWords.length);
  for (let n = max; n > 0; n--) {
    if (aWords.slice(-n).join(' ') === bWords.slice(0, n).join(' ')) {
      overlap = n;
      break;
    }
  }
  return [...aWords, ...bWords.slice(overlap)].join(' ');
};

const dropCommittedPrefix = (committed, interim) => {
  const a = normalizeWords(committed);
  const b = normalizeWords(interim);
  if (!b) return '';
  if (!a) return b;
  if (a.endsWith(b)) return '';
  const aWords = a.split(' ');
  const bWords = b.split(' ');
  let overlap = 0;
  const max = Math.min(aWords.length, bWords.length);
  for (let n = max; n > 0; n--) {
    if (aWords.slice(-n).join(' ') === bWords.slice(0, n).join(' ')) {
      overlap = n;
      break;
    }
  }
  return bWords.slice(overlap).join(' ');
};

// NoteForm: mic starts immediately; Save or closing the window finishes the note.
const NoteForm = ({ onSubmit, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');

  const committedRef = useRef('');
  const sessionFinalRef = useRef('');
  const interimRef = useRef('');
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(true);
  const finishedRef = useRef(false);
  const onSubmitRef = useRef(onSubmit);
  const onCancelRef = useRef(onCancel);
  onSubmitRef.current = onSubmit;
  onCancelRef.current = onCancel;

  const getFullText = () =>
    joinTranscript(committedRef.current, sessionFinalRef.current, interimRef.current);

  const finish = (save) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    shouldListenRef.current = false;
    const text = getFullText();
    try {
      recognitionRef.current && recognitionRef.current.stop();
    } catch (err) {}
    if (save && text) {
      onSubmitRef.current(text);
    } else {
      onCancelRef.current();
    }
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not available.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'uk-UA';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    recognitionRef.current = rec;

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0] && event.results[i][0].transcript;
        if (!piece) continue;
        if (event.results[i].isFinal) {
          committedRef.current = mergeTranscript(committedRef.current, piece);
        } else {
          interim = mergeTranscript(interim, piece);
        }
      }
      sessionFinalRef.current = '';
      const shownInterim = dropCommittedPrefix(committedRef.current, interim);
      interimRef.current = shownInterim;
      setFinalText(committedRef.current);
      setInterimText(shownInterim);
    };

    rec.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.error('Recognition error:', event.error);
      if (event.error === 'not-allowed') {
        shouldListenRef.current = false;
        alert('Microphone access denied.');
      }
    };

    rec.onend = () => {
      sessionFinalRef.current = '';
      interimRef.current = '';
      setFinalText(committedRef.current);
      setInterimText('');
      if (!shouldListenRef.current) {
        setIsRecording(false);
        return;
      }
      setTimeout(() => {
        if (!shouldListenRef.current) return;
        try {
          rec.start();
          setIsRecording(true);
        } catch (err) {}
      }, 200);
    };

    shouldListenRef.current = true;
    try {
      rec.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recognition:', err);
      alert('Speech recognition is not available.');
    }

    const persistOnLeave = () => finish(true);
    const onVisibility = () => {
      if (document.hidden) persistOnLeave();
    };
    window.addEventListener('pagehide', persistOnLeave);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      shouldListenRef.current = false;
      window.removeEventListener('pagehide', persistOnLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      try {
        rec.stop();
      } catch (err) {}
    };
  }, []);

  return (
    <div className="space-y-4">
      <p className={`text-sm font-semibold ${isRecording ? 'text-red-500' : 'text-gray-500'}`}>
        {isRecording ? 'Recording… keep talking' : 'Restarting microphone…'}
      </p>
      <div className="w-full min-h-[8rem] p-3 border rounded bg-gray-50 whitespace-pre-wrap">
        {finalText || interimText ? (
          <>
            <span className="text-gray-800">{finalText}</span>
            {interimText ? (
              <span className="text-gray-400">{finalText ? ' ' : ''}{interimText}</span>
            ) : null}
          </>
        ) : (
          <span className="text-gray-400">Speak now. Press Save when you are done.</span>
        )}
      </div>
      <div className="flex space-x-2">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded"
          onClick={() => finish(true)}
        >
          Save
        </button>
        <button
          className="px-4 py-2 bg-gray-500 text-white rounded"
          onClick={() => finish(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// NoteView component
const NoteView = ({ note, onSave, onCancel }) => {
  const [title, setTitle] = useState(noteTitle(note));
  const [text, setText] = useState(note.text);

  const handleSave = () => {
    const updatedNote = {
      ...note,
      title: title.trim() || makeTitle(text),
      text
    };
    onSave(updatedNote);
  };

  return (
    <div className="space-y-4">
      <input
        className="w-full p-2 border rounded font-semibold"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Назва"
      />
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
  const [searchText, setSearchText] = useState('');
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState({});
  const [copyStatus, setCopyStatus] = useState('');

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
    setIsSummarizing(true);
    try {
      const title = await summarizeTitle(transcript);
      const note = {
        id: crypto.randomUUID(),
        title,
        text: transcript,
        createdAt: new Date().toISOString()
      };
      await saveNote(note);
      setNotes(prev => [...prev, note]);
      setCurrentScreen('list');
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const exitSelect = () => {
    setSelecting(false);
    setSelectedIds({});
    setCopyStatus('');
  };

  const copySelected = async () => {
    const selected = notes.filter(note => selectedIds[note.id]);
    if (!selected.length) return;
    const payload = selected.map(formatNoteForCopy).join('\n\n');
    try {
      await navigator.clipboard.writeText(payload);
      setCopyStatus('Copied');
      setTimeout(() => setCopyStatus(''), 1500);
    } catch (error) {
      console.error('Copy failed:', error);
      alert('Could not copy notes.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteNote(id);
      setNotes(prev => prev.filter(note => note.id !== id));
      setSelectedIds(prev => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
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

  // Filter notes by search
  const filteredNotes = notes.filter(note => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    const title = noteTitle(note).toLowerCase();
    const body = (note.text || '').toLowerCase();
    return title.includes(q) || body.includes(q);
  });

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Voice Notes</h1>
      {currentScreen === 'list' ? (
        <>
          <div className="mb-4">
            <input
              className="w-full p-2 border rounded"
              placeholder="Search by title or text..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          <NoteList
            notes={filteredNotes}
            onDelete={handleDelete}
            selecting={selecting}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {selecting ? (
              <>
                <button
                  className={`px-4 py-2 rounded ${Object.keys(selectedIds).length ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                  onClick={copySelected}
                  disabled={!Object.keys(selectedIds).length}
                >
                  {copyStatus || `Copy (${Object.keys(selectedIds).length})`}
                </button>
                <button
                  className="px-4 py-2 bg-gray-500 text-white rounded"
                  onClick={exitSelect}
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <button
                  className="px-4 py-2 bg-blue-500 text-white rounded"
                  onClick={() => {
                    ensureSummarizer();
                    setCurrentScreen('form');
                  }}
                >
                  New Note
                </button>
                <button
                  className={`px-4 py-2 rounded ${notes.length ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                  onClick={() => setSelecting(true)}
                  disabled={!notes.length}
                >
                  Select
                </button>
                <button
                  className={`px-4 py-2 rounded ${notes.length ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                  onClick={() => setDeleteAllOpen(true)}
                  disabled={!notes.length}
                >
                  Delete All Notes
                </button>
              </>
            )}
          </div>
          <DeleteAllDialog
            open={deleteAllOpen}
            onClose={() => setDeleteAllOpen(false)}
            onConfirm={handleDeleteAll}
          />
        </>
      ) : (
        <NoteForm
          onSubmit={handleNewNote}
          onCancel={() => setCurrentScreen('list')}
        />
      )}
      {isSummarizing ? (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg text-gray-800 font-semibold">
            Generating title…
          </div>
        </div>
      ) : null}
    </div>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);