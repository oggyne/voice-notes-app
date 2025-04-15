const NoteList = ({ notes }) => {
  return (
    <div>
      {notes.length ? notes.map(note => (
        <div key={note.id} className="p-2 border-b">
          <p>{note.text}</p>
          <p className="text-sm text-gray-500">{note.tags.map(t => t.value).join(', ')}</p>
        </div>
      )) : <p>No notes yet.</p>}
    </div>
  );
};

export default NoteList;