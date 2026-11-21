import type { Recording } from './runner';
import { expandStates } from './snapshot';
import type { Loose, Scenario } from './types';

const SAVE_URL = '/api/orders/save-dates';

/** Returns one message per expectation that the recording does not meet (empty when all hold). */
export function checkExpectations(rec: Recording, sc: Scenario): string[] {
  const failures: string[] = [];
  const states = expandStates(rec.steps);
  for (const e of sc.expect ?? []) {
    const stepRec = rec.steps[e.step - 1];
    if (!stepRec) {
      failures.push(`step ${e.step} does not exist`);
      continue;
    }
    const flat: Record<string, Loose> = states[e.step - 1];
    const ev = stepRec.events || {};
    const fail = (what: string) => failures.push(`step ${e.step}: ${what}`);

    if ('toast' in e) {
      const texts = (ev.toasts || []).map((t) => t.replace(/^[a-z]+: /, ''));
      if (!texts.includes(e.toast)) fail(`expected toast "${e.toast}", saw ${JSON.stringify(texts)}`);
    } else if ('noToast' in e) {
      if ((ev.toasts || []).length) fail(`expected no toast, saw ${JSON.stringify(ev.toasts)}`);
    } else if ('confirm' in e) {
      const msgs = (ev.confirms || []).map((c) => c.message);
      if (!msgs.includes(e.confirm)) fail(`expected confirm "${e.confirm}", saw ${JSON.stringify(msgs)}`);
    } else if ('saved' in e) {
      const sent = (ev.requests || []).some((r) => r.method === 'POST' && r.url === SAVE_URL);
      if (sent !== e.saved) fail(e.saved ? 'expected a save-dates request' : 'expected no save-dates request');
    } else if ('field' in e) {
      const [row, name] = e.field;
      const base = `table.rows[${row}].fields.${name}`;
      if (!(`${base}.value` in flat)) {
        fail(`no field ${name} in row ${row}`);
        continue;
      }
      for (const key of ['value', 'disabled', 'title', 'min'] as const) {
        if (!(key in e)) continue;
        const want = (e as Loose)[key];
        const have = key === 'min' && !(`${base}.min` in flat) ? null : flat[`${base}.${key}`];
        if (JSON.stringify(have) !== JSON.stringify(want)) fail(`row ${row} ${name}.${key}: expected ${JSON.stringify(want)}, got ${JSON.stringify(have)}`);
      }
    } else if ('status' in e) {
      const have = flat['general.Order Status.value'];
      if (have !== e.status) fail(`Order Status: expected ${e.status}, got ${have}`);
    } else if ('router' in e) {
      const calls = (ev.router || []).map((c) => (c.args.length ? `${c.fn}:${c.args.join(',')}` : c.fn));
      if (!calls.includes(e.router)) fail(`expected router call ${e.router}, saw ${JSON.stringify(calls)}`);
    } else if ('cell' in e) {
      const [row, col] = e.cell;
      const have = flat[`table.rows[${row}].text[${col}]`];
      if (have !== e.text) fail(`cell [${row},${col}]: expected ${JSON.stringify(e.text)}, got ${JSON.stringify(have)}`);
    } else if ('body' in e) {
      const req = (ev.requests || []).find((r) => r.method === 'POST' && r.url === SAVE_URL);
      if (!req) {
        fail('no save-dates request to check');
        continue;
      }
      const { item, key, itemData, equals } = e.body;
      let target: Loose = req.body;
      if (item !== undefined) target = target?.fabricItems?.[item];
      if (itemData) target = target?.itemData;
      const have = target?.[key];
      if (JSON.stringify(have) !== JSON.stringify(equals)) fail(`body ${item ?? ''}${itemData ? '.itemData' : ''}.${key}: expected ${JSON.stringify(equals)}, got ${JSON.stringify(have)}`);
    }
  }
  return failures;
}
