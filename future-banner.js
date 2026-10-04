(() => {
  'use strict';

  // Run in the head so the first-visit timestamp is recorded before page content loads.
  const storageKey = 'desafio-first-visit-at';
  const now = Date.now();
  let startedAt = now;
  let firstVisit = true;
  try {
    const saved = Number(localStorage.getItem(storageKey));
    if (Number.isSafeInteger(saved) && saved > 0 && saved <= now) {
      startedAt = saved;
      firstVisit = false;
    } else {
      localStorage.setItem(storageKey, String(now));
    }
  } catch {
    // A denied read or write falls back to this visit, with no persistence.
    startedAt = now;
    firstVisit = true;
  }

  function initialize() {
    const banner = document.getElementById('future-banner');
    const timer = document.getElementById('future-timer');
    if (!banner || !timer) return;
    const root = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const digits = document.createElement('span');
    digits.className = 'future-timer-digits';
    digits.setAttribute('aria-hidden', 'true');
    timer.replaceChildren(digits);
    let previous = '';
    let cells = [];

    // Native adaptation of React Bits Counter's ten-number digit wheel.
    // Two copies let 9 -> 0 move down one slot before an invisible reset.
    function settle(cell) {
      if (!cell.track) return;
      clearTimeout(cell.cleanup);
      cell.element.classList.remove('is-changing');
      cell.track.style.transform = `translateY(${-(19 - Number(cell.value)) * 1.25}em)`;
    }

    function roll(cell, from, to) {
      settle(cell);
      const distance = (Number(to) - Number(from) + 10) % 10;
      cell.track.style.transform = `translateY(${-(19 - Number(from)) * 1.25}em)`;
      cell.element.getBoundingClientRect();
      cell.value = to;
      cell.element.classList.add('is-changing');
      cell.track.style.transform = `translateY(${-(19 - Number(from) - distance) * 1.25}em)`;
      cell.cleanup = setTimeout(() => settle(cell), 550);
    }

    function createCell(character) {
      const element = document.createElement('span');
      if (character === ':') {
        element.className = 'future-timer-colon';
        element.textContent = ':';
        return {element};
      }
      element.className = 'future-digit';
      const track = document.createElement('span');
      track.className = 'future-counter-wheel';
      for (let index = 0; index < 20; index++) {
        const number = document.createElement('span');
        number.className = 'future-counter-number';
        number.textContent = String(9 - index % 10);
        track.append(number);
      }
      element.append(track);
      const cell = {element, track, value: character};
      settle(cell);
      return cell;
    }

    function render(value, animate) {
      timer.setAttribute('aria-label', value);
      const alignedPrevious = previous.padStart(value.length, ' ');
      if (value.length !== previous.length) {
        cells.forEach(settle);
        cells = [...value].map(createCell);
        digits.replaceChildren(...cells.map(cell => cell.element));
      }
      [...value].forEach((character, index) => {
        const cell = cells[index];
        if (!cell.track) return;
        const old = alignedPrevious[index];
        if (animate && /[0-9]/.test(old) && character !== old) {
          roll(cell, old, character);
        } else if (!animate || character !== old) {
          cell.value = character;
          settle(cell);
        }
      });
      previous = value;
    }
    function updateTimer(animate = false) {
      const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
      const minutes = String(Math.floor(seconds / 60) % 60).padStart(2, '0');
      const remainingSeconds = String(seconds % 60).padStart(2, '0');
      render(`${hours}:${minutes}:${remainingSeconds}`,
        animate && !banner.hidden && !document.hidden && !reducedMotion.matches);
    }

    function updateSpace() {
      if (!banner.hidden) {
        root.style.setProperty('--future-banner-height', `${banner.getBoundingClientRect().height}px`);
      }
    }

    function showBanner() {
      updateTimer();
      banner.hidden = false;
      updateSpace();
      banner.getBoundingClientRect();
      root.classList.add('future-banner-visible');
    }

    function refresh() {
      updateTimer();
      if (banner.hidden && Date.now() >= startedAt + 10000) showBanner();
      updateSpace();
    }

    updateTimer();
    setInterval(() => updateTimer(true), 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refresh();
    });
    window.addEventListener('pageshow', refresh);
    window.addEventListener('resize', updateSpace);
    reducedMotion.addEventListener('change', () => updateTimer());
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateSpace).observe(banner);
    if (firstVisit) setTimeout(showBanner, Math.max(0, startedAt + 10000 - Date.now()));
    else showBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once: true});
  else initialize();
})();
