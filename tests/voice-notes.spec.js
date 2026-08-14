const path = require('path');
const { test, expect } = require('@playwright/test');
const { voiceNotes, extraScenarios } = require('./scenarios');

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: path.join(__dirname, 'speech-mock.js') });
});

async function waitReady(page) {
  await page.getByRole('heading', { name: 'Voice Notes' }).waitFor();
  await page.getByRole('button', { name: 'New Note' }).waitFor();
}

async function dictate(page, text, isFinal = true) {
  await page.waitForFunction(() => window.__speech && window.__speech.instance);
  await page.evaluate(({ text, isFinal }) => {
    window.__speech.dictate(text, isFinal);
  }, { text, isFinal });
}

async function createNoteByVoice(page, text, chunks) {
  await page.getByRole('button', { name: 'New Note' }).click();
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  if (chunks && chunks.length) {
    for (const chunk of chunks) {
      await dictate(page, chunk, true);
    }
  } else {
    await dictate(page, text, true);
  }
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'New Note' })).toBeVisible({ timeout: 15000 });
}

function noteCards(page) {
  return page.locator('.relative.overflow-hidden.rounded-lg');
}

async function readNote(page, index) {
  const card = noteCards(page).nth(index);
  const title = (await card.locator('[data-note-title]').innerText()).trim();
  await card.locator('[data-note-date]').click();
  const body = (await card.locator('.whitespace-pre-wrap').innerText()).trim();
  await card.locator('[data-note-date]').click();
  return { title, body };
}

test.describe('Voice notes', () => {
  test('dictates 10 Ukrainian notes of different length', async ({ page }) => {
    await page.goto('/');
    await waitReady(page);
    const report = [];

    for (const scenario of voiceNotes) {
      await createNoteByVoice(page, scenario.text);
      const recorded = await readNote(page, 0);
      report.push({
        id: scenario.id,
        intent: scenario.title,
        dictated: scenario.text,
        savedTitle: recorded.title,
        savedBody: recorded.body,
        bodyMatch: recorded.body === scenario.text
      });
    }

    console.log('\n=== 10 NOTES REPORT ===\n' + JSON.stringify(report, null, 2));

    for (const row of report) {
      expect(row.savedBody, row.id).toBe(row.dictated);
      expect(row.savedTitle, row.id + ' title').toBeTruthy();
      expect(row.savedTitle.endsWith(','), row.id + ' no trailing comma').toBe(false);
    }

    await expect(noteCards(page)).toHaveCount(10);
  });

  test('merges duplicate mobile chunks into one phrase', async ({ page }) => {
    const scenario = extraScenarios.find((item) => item.id === 'x-duplicate');
    await page.goto('/');
    await waitReady(page);
    await createNoteByVoice(page, scenario.expected, scenario.chunks);
    const recorded = await readNote(page, 0);
    expect(recorded.body).toBe(scenario.expected);
  });

  test('continues after a pause without dropping the first phrase', async ({ page }) => {
    const scenario = extraScenarios.find((item) => item.id === 'x-pause');
    await page.goto('/');
    await waitReady(page);
    await createNoteByVoice(page, scenario.expected, scenario.chunks);
    const recorded = await readNote(page, 0);
    expect(recorded.body).toBe(scenario.expected);
  });

  test('dedupes overlapping tail and head', async ({ page }) => {
    const scenario = extraScenarios.find((item) => item.id === 'x-overlap');
    await page.goto('/');
    await waitReady(page);
    await createNoteByVoice(page, scenario.expected, scenario.chunks);
    const recorded = await readNote(page, 0);
    expect(recorded.body).toBe(scenario.expected);
  });

  test('Cancel does not save a note', async ({ page }) => {
    await page.goto('/');
    await waitReady(page);
    await page.getByRole('button', { name: 'New Note' }).click();
    await dictate(page, 'Це не повинно зберегтись', true);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('No notes yet.')).toBeVisible();
  });

  test('several notes can stay expanded', async ({ page }) => {
    await page.goto('/');
    await waitReady(page);
    await createNoteByVoice(page, voiceNotes[0].text);
    await createNoteByVoice(page, voiceNotes[1].text);
    const first = noteCards(page).nth(0);
    const second = noteCards(page).nth(1);
    await first.locator('[data-note-date]').click();
    await second.locator('[data-note-date]').click();
    await expect(first.locator('.whitespace-pre-wrap')).toHaveCount(1);
    await expect(second.locator('.whitespace-pre-wrap')).toHaveCount(1);
    await first.locator('[data-note-date]').click();
    await expect(first.locator('.whitespace-pre-wrap')).toHaveCount(0);
    await expect(second.locator('.whitespace-pre-wrap')).toHaveCount(1);
  });

  test('Select copies title, body and date', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await waitReady(page);
    await createNoteByVoice(page, voiceNotes[0].text);
    await createNoteByVoice(page, voiceNotes[1].text);
    await page.getByRole('button', { name: 'Select' }).click();
    await noteCards(page).nth(0).click();
    await noteCards(page).nth(1).click();
    await page.getByRole('button', { name: /Copy \(2\)/ }).click();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain(voiceNotes[0].text);
    expect(clipboard).toContain(voiceNotes[1].text);
    const blocks = clipboard.split('\n\n');
    expect(blocks.length).toBe(2);
    for (const block of blocks) {
      const lines = block.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('search filters by text', async ({ page }) => {
    await page.goto('/');
    await waitReady(page);
    await createNoteByVoice(page, voiceNotes[0].text);
    await createNoteByVoice(page, voiceNotes[4].text);
    await page.getByPlaceholder('Search by title or text...').fill('світло');
    await expect(noteCards(page)).toHaveCount(1);
    await expect(noteCards(page)).toContainText('світло');
  });

  async function swipeNote(page, card, distance) {
    const panel = card.locator('[data-note-panel]');
    const box = await panel.boundingBox();
    const y = box.y + Math.min(20, box.height / 2);
    const startX = box.x + box.width - 16;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX - distance, y, { steps: 15 });
    await page.mouse.up();
  }

  test('short swipe reveals Delete but keeps the note', async ({ page }) => {
    await page.goto('/');
    await waitReady(page);
    await createNoteByVoice(page, voiceNotes[0].text);
    const card = noteCards(page).nth(0);
    await swipeNote(page, card, 100);
    await expect
      .poll(async () =>
        card.locator('[data-note-panel]').evaluate((el) => getComputedStyle(el).transform)
      )
      .toMatch(/-80/);
    await expect(noteCards(page)).toHaveCount(1);
  });

  test('long swipe deletes the note', async ({ page }) => {
    await page.goto('/');
    await waitReady(page);
    await createNoteByVoice(page, voiceNotes[0].text);
    await createNoteByVoice(page, voiceNotes[1].text);
    await swipeNote(page, noteCards(page).nth(0), 200);
    await expect(noteCards(page)).toHaveCount(1);
    await expect(noteCards(page).locator('[data-note-title]')).toContainText('Купити хліб');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(noteCards(page)).toHaveCount(2);
    await expect(noteCards(page).nth(0).locator('[data-note-title]')).toContainText('Зателефонувати');
  });

  test('pagehide saves the in-progress recording', async ({ page }) => {
    await page.goto('/');
    await waitReady(page);
    await page.getByRole('button', { name: 'New Note' }).click();
    await dictate(page, 'Збережи це при закритті вікна', true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await expect(page.getByRole('button', { name: 'New Note' })).toBeVisible({ timeout: 15000 });
    const recorded = await readNote(page, 0);
    expect(recorded.body).toBe('Збережи це при закритті вікна');
  });

  test('Summarizer headline is used instead of the first sentence', async ({ page }) => {
    await page.addInitScript(() => {
      window.Summarizer = {
        availability: async () => 'available',
        create: async () => ({
          summarize: async () => 'Оплата рахунку за світло'
        })
      };
    });
    await page.goto('/');
    await waitReady(page);
    await createNoteByVoice(page, voiceNotes[4].text);
    const recorded = await readNote(page, 0);
    expect(recorded.body).toBe(voiceNotes[4].text);
    expect(recorded.title).toBe('Оплата рахунку за світло');
  });

  test('Save without speech does not create a note', async ({ page }) => {
    await page.goto('/');
    await waitReady(page);
    await page.getByRole('button', { name: 'New Note' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('No notes yet.')).toBeVisible();
  });

  test('search also matches the generated title', async ({ page }) => {
    await page.goto('/');
    await waitReady(page);
    await createNoteByVoice(page, voiceNotes[2].text);
    await createNoteByVoice(page, voiceNotes[0].text);
    await page.getByPlaceholder('Search by title or text...').fill('Андрієм');
    await expect(noteCards(page)).toHaveCount(1);
    await expect(noteCards(page).locator('[data-note-title]')).toContainText('Андрієм');
  });

  test('newest note is first in the list', async ({ page }) => {
    await page.goto('/');
    await waitReady(page);
    await createNoteByVoice(page, voiceNotes[0].text);
    await createNoteByVoice(page, voiceNotes[1].text);
    await expect(noteCards(page).nth(0).locator('[data-note-title]')).toContainText('Зателефонувати');
    await expect(noteCards(page).nth(1).locator('[data-note-title]')).toContainText('Купити хліб');
  });

  test('title can be edited in the expanded card', async ({ page }) => {
    await page.goto('/');
    await waitReady(page);
    await createNoteByVoice(page, voiceNotes[0].text);
    const card = noteCards(page).nth(0);
    await card.locator('[data-note-date]').click();
    const titleInput = card.locator('[data-note-title-input]');
    await titleInput.fill('Список покупок');
    await titleInput.press('Enter');
    await card.locator('[data-note-date]').click();
    await expect(card.locator('[data-note-title]')).toHaveText('Список покупок');
  });

  test('note date uses Ukrainian locale', async ({ page }) => {
    await page.goto('/');
    await waitReady(page);
    await createNoteByVoice(page, voiceNotes[0].text);
    await expect(noteCards(page).nth(0).locator('[data-note-date]')).toHaveText(
      /січ|лют|бер|квіт|трав|черв|лип|серп|вер|жовт|лист|груд/i
    );
  });

  test.skip('manual: live microphone on a phone', () => {
    // Real Web Speech on Android/iOS cannot be mocked here.
    // Dictation script: tests/scenarios.js -> voiceNotes.
  });
});
