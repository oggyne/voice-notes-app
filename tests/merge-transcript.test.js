const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  mergeTranscript,
  dropCommittedPrefix
} = require('../src/transcript-utils');

test('mergeTranscript drops exact repeats', () => {
  assert.equal(mergeTranscript('купити молоко', 'купити молоко'), 'купити молоко');
});

test('mergeTranscript keeps going after a pause', () => {
  assert.equal(
    mergeTranscript('Не забути', 'забрати дітей зі школи'),
    'Не забути забрати дітей зі школи'
  );
});

test('mergeTranscript stitches overlapping phrases', () => {
  assert.equal(
    mergeTranscript('зустріч з Андрієм завтра', 'Андрієм завтра о десятій'),
    'зустріч з Андрієм завтра о десятій'
  );
});

test('dropCommittedPrefix hides interim already saved', () => {
  assert.equal(dropCommittedPrefix('купити хліб', 'хліб'), '');
});
