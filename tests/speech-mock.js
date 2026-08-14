class FakeSpeechRecognition {
  constructor() {
    this.lang = '';
    this.continuous = false;
    this.interimResults = false;
    this.maxAlternatives = 1;
    this.onresult = null;
    this.onend = null;
    this.onerror = null;
    window.__speech.instance = this;
  }

  start() {
    window.__speech.started = true;
  }

  stop() {
    window.__speech.started = false;
    if (this.onend) this.onend();
  }

  abort() {
    this.stop();
  }
}

window.__speech = {
  instance: null,
  started: false,
  dictate: function (text, isFinal) {
    var rec = window.__speech.instance;
    if (!rec || !rec.onresult) {
      throw new Error('Speech recognition is not listening');
    }
    var result = [];
    result[0] = { 0: { transcript: text }, isFinal: isFinal, length: 1 };
    rec.onresult({ resultIndex: 0, results: result });
  }
};

window.SpeechRecognition = FakeSpeechRecognition;
window.webkitSpeechRecognition = FakeSpeechRecognition;
try {
  delete window.Summarizer;
} catch (err) {}

