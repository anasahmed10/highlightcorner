const { test } = require('node:test');
const assert = require('node:assert/strict');
const { page, until, deferred, reply } = require('./helpers/page.cjs');

test('game tabs expose named panels, one tab stop and wrap with arrow/Home/End keys', async t => {
  const p = page(t, 'game.html', { query: '?id=1003&week=5' });
  await until(() => p.doc.querySelector('[role=tab]'));
  for (const group of p.doc.querySelectorAll('[data-tabgroup]')) {
    const tabs = [...group.querySelectorAll('[role=tab]')];
    const panes = [...group.querySelectorAll('[role=tabpanel]')];
    assert.match(group.querySelector('[role=tablist]').getAttribute('aria-label'), /teams$/);
    tabs.forEach((tab, i) => {
      assert.equal(tab.getAttribute('aria-controls'), panes[i].id);
      assert.equal(panes[i].getAttribute('aria-labelledby'), tab.id);
    });
    const press = (index, key) => tabs[index].dispatchEvent(new p.w.KeyboardEvent('keydown', { key, bubbles: true }));
    press(0, 'End');
    assert.equal(p.doc.activeElement, tabs.at(-1));
    assert.equal(tabs.at(-1).getAttribute('aria-selected'), 'true');
    assert.equal(panes[0].hidden, tabs.length > 1);
    assert.equal(panes.at(-1).hidden, false);
    press(tabs.length - 1, 'ArrowRight');
    assert.equal(p.doc.activeElement, tabs[0]);
    press(0, 'ArrowLeft');
    assert.equal(p.doc.activeElement, tabs.at(-1));
    press(tabs.length - 1, 'Home');
    assert.equal(tabs.filter(tab => tab.tabIndex === 0).length, 1);
    assert.equal(p.doc.activeElement, tabs[0]);
  }
});

test('favorite and watched controls retain focus and expose their pressed state after rerender', async t => {
  const p = page(t);
  await until(() => p.doc.querySelector('.game-card'));
  const favorite = p.doc.querySelector('[data-team=PIT]');
  favorite.focus(); favorite.click();
  assert.equal(p.doc.activeElement.dataset.team, 'PIT');
  assert.equal(p.doc.activeElement.getAttribute('aria-pressed'), 'true');
  const watched = p.doc.querySelector('.watched-toggle');
  const key = watched.dataset.focusKey;
  watched.focus(); watched.click();
  assert.equal(p.doc.activeElement.dataset.focusKey, key);
  assert.equal(p.doc.activeElement.getAttribute('aria-pressed'), 'true');
});

test('keyboard sorting announces the table, column and direction without moving focus', async t => {
  const p = page(t, 'fantasy.html');
  await until(() => p.doc.querySelector('.table-sort'));
  const button = p.doc.querySelector('.table-sort');
  button.focus(); button.click();
  assert.equal(p.doc.activeElement, button);
  assert.match(button.getAttribute('aria-label'), /sort ascending/);
  assert.match(p.doc.querySelector('body > .sr-only[role=status]').textContent, /Quarterbacks: sorted by #, descending/);
  button.click();
  assert.match(p.doc.querySelector('body > .sr-only[role=status]').textContent, /ascending/);
});

test('game live refresh preserves keyboard focus and user tab changes made while the request is pending', async t => {
  let delay = false;
  const pending = deferred();
  const p = page(t, 'game.html', { query: '?id=1003&week=5', fetch: (url, _init, data) => {
    if (url.pathname.endsWith('/summary')) {
      const summary = structuredClone(data.summary);
      summary.header.status.type.state = 'in';
      if (delay) return pending.promise;
      return reply(summary);
    }
  } });
  await until(() => p.doc.querySelector('[role=tab]'));
  delay = true;
  Object.defineProperty(p.doc, 'visibilityState', { configurable: true, value: 'visible' });
  p.doc.dispatchEvent(new p.w.Event('visibilitychange'));
  const target = p.doc.querySelectorAll('[role=tab]')[1];
  target.focus(); target.click();
  const id = target.id;
  pending.resolve(reply(p.data.summary));
  await until(() => p.doc.getElementById(id) !== target);
  assert.equal(p.doc.activeElement.id, id);
  assert.equal(p.doc.activeElement.getAttribute('aria-selected'), 'true');
});
