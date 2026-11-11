// Written by the test app, not by the AI: tested helpers for the tricky parts of a page.
// A test imports what it needs: import { pickDate } from './helpers';
// The VALUE (a date, an option) is always the test's choice; a helper only does the clicks and
// checks its own result. When it did not work it throws a plain sentence ending in
// "(helper NAME)" -- never swallows an error.
import { statSync } from 'node:fs';
import type { FrameLocator, Locator, Page } from '@playwright/test';

const STEP_TIMEOUT = 15000;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fail(helper: string, message: string): never {
  throw new Error(`${message} (helper ${helper})`);
}

// A short name for a field, as a person would say it: its label, placeholder, name or id.
async function nameOf(target: Locator): Promise<string> {
  try {
    return await target.evaluate((node) => {
      const el = node as HTMLInputElement;
      const first = el.labels && el.labels.length ? el.labels[0] : null;
      const own = first ? Array.from(first.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ') : '';
      const label = own.trim() || (first ? first.textContent : '');
      // A button or link is best named by its own text; a select's text is all its options, so not that.
      const tag = node.tagName.toLowerCase();
      const ownText = tag === 'select' || tag === 'input' || tag === 'textarea' ? '' : node.textContent || '';
      const text = el.getAttribute('aria-label') || label || el.getAttribute('placeholder') || el.getAttribute('name') ||
        el.getAttribute('title') || ownText.trim() || el.id || tag;
      return String(text).replace(/\s+/g, ' ').trim().slice(0, 60);
    }, undefined, { timeout: 2000 });
  } catch {
    return 'the field';
  }
}

async function shownValue(field: Locator): Promise<string> {
  try {
    return (await field.inputValue({ timeout: 2000 })).trim();
  } catch {
    return ((await field.textContent({ timeout: 2000 })) || '').trim();
  }
}

const same = (a: string, b: string) => a.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase();

export type DateParts = { year: number; month: number; day: number };

function partsFromIso(value: string): DateParts | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : undefined;
}

// The calendars of the common libraries are tried first; any dialog or grid is only the fallback.
const LIBRARY_CALENDARS = [
  '.flatpickr-calendar.open', '.ui-datepicker', '.react-datepicker', '.datepicker', '.datepicker-dropdown',
  '.daterangepicker', '.MuiPickersPopper-root', '.oxd-calendar-wrapper', '.air-datepicker',
].join(', ');
const GENERIC_CALENDARS = '[role="dialog"], [role="grid"]';
// What was already on screen before the click is marked with this attribute and never taken for the calendar.
const SEEN = 'data-helper-seen';
const unseen = (list: string) => list.split(', ').map((one) => `${one}:not([${SEEN}])`).join(', ');

// Clicks the field, takes the calendar that APPEARS after the click (a modal or data grid that was
// already open is not it), then moves it to the month and year and clicks the day.
async function clickInCalendar(page: Page, field: Locator, name: string, parts: DateParts): Promise<void> {
  await page.evaluate(
    ({ list, mark }) => {
      for (const el of Array.from(document.querySelectorAll(list))) {
        const box = (el as HTMLElement).getBoundingClientRect();
        if (box.width > 0 && box.height > 0) el.setAttribute(mark, '1');
      }
    },
    { list: `${LIBRARY_CALENDARS}, ${GENERIC_CALENDARS}`, mark: SEEN },
  );
  try {
    await field.click({ timeout: STEP_TIMEOUT });
    // From here on a failure is the calendar's own (this helper could not handle that widget), so it
    // is said as a helper error; a field that cannot be found or clicked above stays Playwright's own.
    const started = Date.now();
    let calendar: Locator | undefined;
    while (!calendar && Date.now() - started < 5000) {
      const library = page.locator(unseen(LIBRARY_CALENDARS)).filter({ visible: true }).first();
      if (await library.count()) {
        calendar = library;
      } else if (Date.now() - started > 400) {
        // Give a library calendar a moment to show up before settling for a plain dialog or grid.
        const generic = page.locator(unseen(GENERIC_CALENDARS)).filter({ visible: true }).first();
        if (await generic.count()) calendar = generic;
      }
      if (!calendar) await page.waitForTimeout(100);
    }
    if (!calendar) fail('pickDate', `No calendar opened when '${name}' was clicked`);
    await useCalendar(calendar, name, parts);
  } finally {
    await page
      .evaluate((mark) => {
        for (const el of Array.from(document.querySelectorAll(`[${mark}]`))) el.removeAttribute(mark);
      }, SEEN)
      .catch(() => undefined);
  }
}

// Moves an open calendar to the month and year, then clicks the day.
async function useCalendar(calendar: Locator, name: string, parts: DateParts): Promise<void> {
  const month = MONTHS[parts.month - 1];
  const monthWords = new RegExp(`\\b(${month}|${month.slice(0, 3)})\\b`, 'i');
  const yearWord = new RegExp(`\\b${parts.year}\\b`);

  // A month/year chosen from drop-downs or typed into a year box.
  for (const select of await calendar.locator('select').filter({ visible: true }).all()) {
    const options = await select.locator('option').allTextContents();
    const byMonth = options.find((o) => monthWords.test(o));
    if (byMonth) await select.selectOption({ label: byMonth });
    else if (options.some((o) => o.trim() === String(parts.year))) await select.selectOption({ label: String(parts.year) });
  }
  const yearBox = calendar.locator('input[type="number"]').filter({ visible: true }).first();
  if (await yearBox.count()) {
    await yearBox.fill(String(parts.year));
    await yearBox.press('Enter'); // some calendars only take the typed year on Enter
  }

  // Otherwise page through the months until the header shows the wanted month and year.
  for (let step = 0; step < 48; step += 1) {
    const header = await calendar.evaluate((root) => {
      const shown = Array.from(root.querySelectorAll('select')).map((s) => (s as HTMLSelectElement).selectedOptions[0]?.textContent || '');
      const typed = Array.from(root.querySelectorAll('input')).map((i) => (i as HTMLInputElement).value);
      return [...(root as HTMLElement).innerText.split('\n').slice(0, 6), ...shown, ...typed].join(' ');
    });
    if (monthWords.test(header) && yearWord.test(header)) break;
    const found = header.match(/\b(\d{4})\b/);
    const shownYear = found ? Number(found[1]) : parts.year;
    const shownMonth = MONTHS.findIndex((name) => new RegExp(`\\b(${name}|${name.slice(0, 3)})\\b`, 'i').test(header)) + 1;
    const later = shownYear * 12 + shownMonth < parts.year * 12 + parts.month;
    let button = calendar.getByRole('button', { name: later ? /next|forward|›|»|>/i : /prev|previous|back|‹|«|</i }).first();
    if (!(await button.count())) {
      // Arrows that are links or spans: found by their label, title or class.
      button = calendar
        .locator(later
          ? '[aria-label*="next" i], [title*="next" i], [class*="next-month"], [class*="-next"]'
          : '[aria-label*="prev" i], [title*="prev" i], [class*="prev-month"], [class*="-prev"]')
        .filter({ visible: true })
        .first();
    }
    if (!(await button.count())) fail('pickDate', `The calendar has no way to move to ${month} ${parts.year}`);
    await button.click({ timeout: STEP_TIMEOUT }).catch(() => fail('pickDate', `The calendar of '${name}' could not be moved to ${month} ${parts.year}`));
  }

  const day = String(parts.day);
  let cell = calendar.getByRole('gridcell', { name: new RegExp(`\\b0?${day}\\b.*${month}|${month}.*\\b0?${day}\\b`, 'i') }).first();
  if (!(await cell.count())) cell = calendar.getByRole('button', { name: new RegExp(`\\b0?${day}\\b.*${month}|${month}.*\\b0?${day}\\b`, 'i') }).first();
  if (!(await cell.count())) {
    cell = calendar
      .locator('td, button, span, div, a')
      .filter({ hasText: new RegExp(`^\\s*0?${day}\\s*$`) })
      .filter({ visible: true })
      .locator(':scope:not([class*="other-month"]):not([class*="outside"]):not([class*="prev"]):not([class*="next"]):not([class*="disabled"])')
      .first();
  }
  if (!(await cell.count())) fail('pickDate', `The day ${day} was not found in the calendar of '${name}'`);
  await cell.click({ timeout: STEP_TIMEOUT }).catch(() => fail('pickDate', `The day ${day} could not be clicked in the calendar of '${name}'`));
}

/**
 * Sets a date or time field. `value` is written exactly as the field shows dates (the test
 * reads that format from the field); `parts` lets a calendar popup be used when typing does not
 * work (it is read from an ISO `YYYY-MM-DD` value when omitted).
 */
export async function pickDate(page: Page, field: Locator, value: string, parts?: DateParts): Promise<void> {
  const name = await nameOf(field);
  const type = ((await field.getAttribute('type', { timeout: STEP_TIMEOUT })) || '').toLowerCase();
  const nativeTypes = ['date', 'time', 'datetime-local', 'month', 'week'];
  const wanted = parts || partsFromIso(value);
  const typedOk = async () => same(await shownValue(field), value);

  if (nativeTypes.includes(type)) {
    await field.fill(value, { timeout: STEP_TIMEOUT });
  } else {
    // First the plain way: type it (most widgets that look like a calendar also accept typing).
    const typed = await field
      .fill(value, { timeout: 3000 })
      .then(() => true, () => false);
    if (typed) await field.press('Tab').catch(() => undefined);
    if (!typed || !(await typedOk())) {
      if (!wanted) fail('pickDate', `Date '${value}' was not set in '${name}' (it shows '${await shownValue(field)}'; pass year, month and day to use the calendar)`);
      await clickInCalendar(page, field, name, wanted);
      await field.press('Tab').catch(() => undefined);
    }
  }
  const shown = await shownValue(field);
  if (!same(shown, value)) fail('pickDate', `Date '${value}' was not set in '${name}' (it shows '${shown || 'nothing'}')`);
}

/**
 * Picks an option from a native select, a custom dropdown or a search-to-select box, then checks
 * the control shows it.
 */
export async function selectOption(page: Page, control: Locator, option: string | RegExp): Promise<void> {
  const name = await nameOf(control);
  const label = typeof option === 'string' ? option : option.source;
  const tag = await control.evaluate((node) => node.tagName.toLowerCase(), undefined, { timeout: STEP_TIMEOUT });

  if (tag === 'select') {
    const texts = (await control.locator('option').allTextContents()).map((t) => t.trim());
    // An exact name wins ("Admin" is not "Super Admin"); a partial match is only the fallback.
    const wanted =
      typeof option === 'string'
        ? texts.find((t) => t === option.trim()) ?? texts.find((t) => t.toLowerCase().includes(option.trim().toLowerCase()))
        : texts.find((t) => option.test(t));
    if (wanted === undefined) fail('selectOption', `Option '${label}' was not found in '${name}' (it offers: ${texts.slice(0, 8).join(', ')})`);
    await control.selectOption({ label: wanted }, { timeout: STEP_TIMEOUT });
    const chosen = await control.evaluate((node) => {
      const select = node as HTMLSelectElement;
      return (select.selectedOptions[0]?.textContent || '').trim();
    });
    if (chosen !== wanted) fail('selectOption', `Option '${label}' was not selected in '${name}' (it shows '${chosen}')`);
    return;
  }

  // Read through a handle taken now: once an option is picked the control's name can change.
  const handle = await control.elementHandle({ timeout: STEP_TIMEOUT });
  if (!handle) fail('selectOption', `The control '${name}' was not found`);
  await control.click({ timeout: STEP_TIMEOUT });
  const editable = tag === 'input' || tag === 'textarea';
  if (editable && typeof option === 'string') {
    // Search-to-select: type to search, then wait for the results to finish loading.
    await control.fill('', { timeout: 3000 }).catch(() => undefined);
    await control.pressSequentially(option, { delay: 20 });
    await page
      .locator('[role="progressbar"], [aria-busy="true"], .spinner, .loading, .loader')
      .filter({ visible: true })
      .first()
      .waitFor({ state: 'hidden', timeout: 10000 })
      .catch(() => undefined);
  }
  const listId = await control.getAttribute('aria-controls');
  const scope = listId ? page.locator(`[id="${listId}"]`) : page;
  const partial = scope.getByRole('option', { name: option }).filter({ visible: true });
  try {
    await partial.first().waitFor({ state: 'visible', timeout: 10000 });
  } catch {
    const offered = (await scope.getByRole('option').filter({ visible: true }).allTextContents()).map((t) => t.trim()).filter(Boolean);
    fail('selectOption', `Option '${label}' was not found in '${name}' (it offers: ${offered.slice(0, 8).join(', ') || 'nothing yet'})`);
  }
  // An exact name wins ("Admin" must not pick "Super Admin"); a partial match is only the fallback.
  const exact = typeof option === 'string' ? scope.getByRole('option', { name: option, exact: true }).filter({ visible: true }) : undefined;
  const choice = exact && (await exact.count()) ? exact.first() : partial.first();
  const chosenText = ((await choice.textContent().catch(() => '')) || '').trim();
  await choice.click({ timeout: STEP_TIMEOUT });

  const shown = await handle.evaluate((node) => {
    const el = node as HTMLInputElement;
    return String(el.value || node.textContent || '').trim();
  });
  const norm = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();
  const showsChosen = chosenText !== '' && norm(shown).includes(norm(chosenText));
  const matches = (typeof option === 'string' ? norm(shown).includes(norm(option)) : option.test(shown)) || showsChosen;
  const listClosed = !(await choice.isVisible().catch(() => false));
  // A list that closed proves nothing when the control shows something else: it only counts when the
  // control shows nothing at all to compare with.
  if (!matches && !(listClosed && shown === '')) {
    fail('selectOption', `Option '${label}' was not selected in '${name}' (it shows '${shown || 'nothing'}')`);
  }
}

/**
 * Runs `trigger` (the click that starts the download) while listening for the download, and
 * checks a real, non-empty file arrived. Returns its name, path and size.
 */
export async function waitForDownload(
  page: Page,
  trigger: () => Promise<unknown>,
  timeout = STEP_TIMEOUT,
): Promise<{ fileName: string; path: string; size: number }> {
  const waiting = page.waitForEvent('download', { timeout });
  waiting.catch(() => undefined);
  await trigger();
  let download;
  try {
    download = await waiting;
  } catch {
    return fail('waitForDownload', `No file was downloaded within ${Math.round(timeout / 1000)} seconds`);
  }
  const problem = await download.failure();
  if (problem) fail('waitForDownload', `The download '${download.suggestedFilename()}' failed (${problem})`);
  const path = await download.path();
  const size = path ? statSync(path).size : 0;
  if (!path || size === 0) fail('waitForDownload', `The downloaded file '${download.suggestedFilename()}' is empty`);
  return { fileName: download.suggestedFilename(), path, size };
}

/**
 * Finds an iframe -- by a CSS selector, or by its name, title or part of its address -- waits
 * for it to load and returns it, ready for `.getByRole(...)` and the like.
 */
export async function inFrame(
  page: Page,
  frame: string | { name?: string; title?: string; url?: string },
): Promise<FrameLocator> {
  const quoted = (text: string) => JSON.stringify(text);
  const selector =
    typeof frame === 'string'
      ? frame
      : frame.name
        ? `iframe[name=${quoted(frame.name)}], frame[name=${quoted(frame.name)}]`
        : frame.title
          ? `iframe[title=${quoted(frame.title)}]`
          : frame.url
            ? `iframe[src*=${quoted(frame.url)}]`
            : 'iframe';
  const described = typeof frame === 'string' ? frame : JSON.stringify(frame);
  const element = page.locator(selector).first();
  try {
    await element.waitFor({ state: 'attached', timeout: STEP_TIMEOUT });
    const handle = await element.elementHandle();
    const inside = handle ? await handle.contentFrame() : null;
    if (!inside) throw new Error('no content');
    await inside.waitForLoadState('domcontentloaded', { timeout: STEP_TIMEOUT });
  } catch {
    fail('inFrame', `The frame ${described} was not found or did not load on the page`);
  }
  // The first match only, so a broad selector (every iframe on the page) is not a strict-mode error.
  return element.contentFrame();
}
