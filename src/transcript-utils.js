function joinTranscript() {
  var parts = Array.prototype.slice.call(arguments);
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function normalizeWords(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function mergeTranscript(prev, next) {
  var a = normalizeWords(prev);
  var b = normalizeWords(next);
  if (!b) return a;
  if (!a) return b;
  if (a === b || a.endsWith(b)) return a;
  if (b.startsWith(a) || (b.includes(a) && b.length > a.length)) return b;
  var aWords = a.split(' ');
  var bWords = b.split(' ');
  var overlap = 0;
  var max = Math.min(aWords.length, bWords.length);
  for (var n = max; n > 0; n--) {
    if (aWords.slice(-n).join(' ') === bWords.slice(0, n).join(' ')) {
      overlap = n;
      break;
    }
  }
  return aWords.concat(bWords.slice(overlap)).join(' ');
}

function dropCommittedPrefix(committed, interim) {
  var a = normalizeWords(committed);
  var b = normalizeWords(interim);
  if (!b) return '';
  if (!a) return b;
  if (a.endsWith(b)) return '';
  var aWords = a.split(' ');
  var bWords = b.split(' ');
  var overlap = 0;
  var max = Math.min(aWords.length, bWords.length);
  for (var n = max; n > 0; n--) {
    if (aWords.slice(-n).join(' ') === bWords.slice(0, n).join(' ')) {
      overlap = n;
      break;
    }
  }
  return bWords.slice(overlap).join(' ');
}

function trimTitleTail(text) {
  var s = normalizeWords(text);
  var prev = '';
  while (s && s !== prev) {
    prev = s;
    s = s.replace(/[\s,;:–—\-]+$/g, '').trim();
    s = s.replace(/\s+(і|та|й|або|а|для|на|у|в|з|із|по|до|про|від|and|or|but)$/i, '').trim();
  }
  return s;
}

function makeTitle(text, maxLength) {
  if (maxLength == null) maxLength = 56;
  var cleaned = normalizeWords(text);
  if (!cleaned) return 'Нотатка';
  var sentenceMatch = cleaned.match(/^[^.!?…]+[.!?…]?/);
  var phrase = trimTitleTail(
    (sentenceMatch ? sentenceMatch[0] : cleaned).replace(/[.!?…]+$/g, '')
  );
  var words = phrase.split(' ');
  if (words.length > 8) {
    phrase = trimTitleTail(words.slice(0, 8).join(' '));
  }
  if (phrase.length > maxLength) {
    var slice = phrase.slice(0, maxLength);
    var lastSpace = slice.lastIndexOf(' ');
    phrase = trimTitleTail(lastSpace > 20 ? slice.slice(0, lastSpace) : slice);
  }
  return phrase || 'Нотатка';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    joinTranscript: joinTranscript,
    normalizeWords: normalizeWords,
    mergeTranscript: mergeTranscript,
    dropCommittedPrefix: dropCommittedPrefix,
    trimTitleTail: trimTitleTail,
    makeTitle: makeTitle
  };
}
