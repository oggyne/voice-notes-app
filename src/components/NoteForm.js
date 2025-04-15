const { useState } = React;

const NoteForm = ({ onSubmit, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = () => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      onSubmit(null);
    }, 3000);
  };

  return (
    <div>
      <button
        className={`bg-green-500 text-white px-4 py-2 rounded ${isRecording ? 'opacity-50' : ''}`}
        onClick={startRecording}
        disabled={isRecording}
      >
        {isRecording ? 'Recording...' : 'Start Recording'}
      </button>
      <button
        className="bg-gray-500 text-white px-4 py-2 rounded ml-2"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
};

export default NoteForm;