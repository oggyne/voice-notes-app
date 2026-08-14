const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeTitle, trimTitleTail } = require('../src/transcript-utils');

test('empty text becomes Нотатка', () => {
  assert.equal(makeTitle(''), 'Нотатка');
});

test('short sentence drops the period', () => {
  assert.equal(makeTitle('Купити хліб.'), 'Купити хліб');
});

test('does not leave a trailing comma after the length cut', () => {
  assert.equal(
    makeTitle('Рахунок за світло тисяча вісімсот сорок гривень, сплатити до двадцятого числа.'),
    'Рахунок за світло тисяча вісімсот сорок гривень'
  );
});

test('strips a dangling conjunction', () => {
  assert.equal(trimTitleTail('Купити хліб, молоко і'), 'Купити хліб, молоко');
  assert.equal(makeTitle('Купити хліб, молоко і'), 'Купити хліб, молоко');
});

test('strips a dangling preposition after the word cap', () => {
  assert.equal(
    makeTitle("Завтра о дев'ятій ранку зустріч з Андрієм у коворкінгу на Подолі."),
    "Завтра о дев'ятій ранку зустріч з Андрієм"
  );
});

test('does not end the service-worker sentence on a comma', () => {
  const title = makeTitle(
    'Оновити service worker на voice-notes-v7 і перевірити, що після деплою на телефоні не лишився старий кеш.'
  );
  assert.equal(title.endsWith(','), false);
  assert.equal(title.endsWith('і'), false);
});
