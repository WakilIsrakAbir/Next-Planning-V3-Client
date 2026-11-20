// Extracts real-data fixtures for the order-page golden master from the LOCAL test database.
// Output: tests/golden/local/fixtures/ (gitignored: real data never leaves this machine).
//
//   node tests/tools/extract-local-fixtures.mjs
//
// LOCAL_MONGO_URI (default mongodb://127.0.0.1:27099/abir_test) must point at the local test server; anything else
// is refused. Read-only: the script only runs find() queries. The MongoDB driver is taken from the server repo next
// to this one (V3_SERVER_DIR, default ../Next Planning V3 Server), so the client gets no new dependency.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const URI = process.env.LOCAL_MONGO_URI || 'mongodb://127.0.0.1:27099/abir_test';
if (!/^mongodb:\/\/127\.0\.0\.1:27099\/[A-Za-z0-9_]+$/.test(URI)) {
  console.error('Refusing to run: LOCAL_MONGO_URI must be mongodb://127.0.0.1:27099/<database> (the local test server).');
  process.exit(1);
}
const SERVER_DIR = resolve(process.env.V3_SERVER_DIR || join(process.cwd(), '..', 'Next Planning V3 Server'));
const { MongoClient } = createRequire(join(SERVER_DIR, 'package.json'))('mongodb');

const OUT = join(process.cwd(), 'tests', 'golden', 'local', 'fixtures');
const DEPTS = ['yd', 'knitting', 'dyeing', 'finishing', 'delivery'];
const STATUSES = ['Pending', 'Tentative', 'Confirm', 'Completed'];
const PER_STATUS = 2;
const UNSAVED = 2;

const hasRows = (doc, key) => Array.isArray(doc?.[key]) && doc[key].length > 0;
const json = (v) => JSON.parse(JSON.stringify(v)); // ObjectId -> hex, Date -> ISO, as the API sends them

async function main() {
  const client = await MongoClient.connect(URI, { serverSelectionTimeoutMS: 5000 });
  try {
    const db = client.db();
    const orders = db.collection('orders');
    const orderDates = db.collection('orderdates');

    rmSync(OUT, { recursive: true, force: true });
    mkdirSync(OUT, { recursive: true });

    // GET /api/dropdowns reads DropdownMaster.find().sort({createdAt: 1})
    const dropdownmasters = await db.collection('dropdownmasters').find().sort({ createdAt: 1 }).toArray();
    writeFileSync(join(OUT, '_dropdowns.json'), JSON.stringify({ dropdownmasters: json(dropdownmasters) }, null, 1) + '\n');

    const index = [];
    const summary = {};
    for (const dept of DEPTS) {
      const candidates = await orders
        .find({ [`${dept}Items.0`]: { $exists: true } }, { projection: { orderNo: 1, [`${dept}PlanStatus`]: 1, finalConfirmation: 1 } })
        .sort({ orderNo: 1 })
        .toArray();
      if (candidates.length === 0) {
        summary[dept] = 0;
        continue;
      }
      const plans = new Map();
      const nos = candidates.map((c) => c.orderNo);
      for (let i = 0; i < nos.length; i += 500) {
        const docs = await orderDates
          .find({ orderNo: { $in: nos.slice(i, i + 500) } }, { projection: { orderNo: 1, knitting: 1, dyeing: 1, delivery: 1, yd: 1, finishing: 1 } })
          .toArray();
        docs.forEach((d) => plans.set(d.orderNo, d));
      }
      const saved = (c) => hasRows(plans.get(c.orderNo), dept);
      const allThree = (c) => ['knitting', 'dyeing', 'delivery'].every((k) => hasRows(plans.get(c.orderNo), k));

      const picked = new Map();
      const pick = (c, tag) => {
        if (!c) return;
        if (!picked.has(c.orderNo)) picked.set(c.orderNo, new Set());
        picked.get(c.orderNo).add(tag);
      };
      for (const status of STATUSES) {
        const inStatus = candidates.filter((c) => c[`${dept}PlanStatus`] === status && saved(c));
        const preferred = ['knitting', 'dyeing', 'delivery'].includes(dept) ? inStatus.filter(allThree) : inStatus;
        const pool = preferred.length >= PER_STATUS ? preferred : inStatus;
        pool.slice(0, PER_STATUS).forEach((c) => pick(c, `status:${status}`));
      }
      candidates.filter((c) => !saved(c)).slice(0, UNSAVED).forEach((c) => pick(c, 'no-saved-plan'));

      // Department specials named in the SPEC: Delivery rows with Floor data, Dyeing rows with Unit/Process.
      if (dept === 'delivery') {
        candidates
          .filter((c) => plans.get(c.orderNo)?.delivery?.some((r) => r && r.floorStartDate))
          .filter((c) => !picked.has(c.orderNo))
          .slice(0, 1)
          .forEach((c) => pick(c, 'floor-data'));
      }
      if (dept === 'dyeing') {
        candidates
          .filter((c) => plans.get(c.orderNo)?.dyeing?.some((r) => r && (r.unit || r.Unit || r.itemData?.Unit) && (r.processName || r.ProcessName || r.itemData?.ProcessName)))
          .filter((c) => !picked.has(c.orderNo))
          .slice(0, 1)
          .forEach((c) => pick(c, 'unit-process'));
        candidates.filter((c) => String(c.finalConfirmation || '').trim().toLowerCase() === 'no').forEach((c) => pick(c, 'final-confirmation-no'));
      }

      let n = 0;
      for (const [orderNo, tags] of picked) {
        n += 1;
        const name = `${dept}-${String(n).padStart(2, '0')}`;
        const order = await orders.findOne({ orderNo });
        const planData = await orderDates.findOne({ orderNo });
        const fixture = { orderNo, orders: [json(order)], orderDates: planData ? [json(planData)] : [] };
        writeFileSync(join(OUT, `${name}.json`), JSON.stringify(fixture) + '\n');
        index.push({ name, dept, orderNo, tags: [...tags] });
      }
      summary[dept] = picked.size;
    }
    writeFileSync(join(OUT, 'index.json'), JSON.stringify({ source: URI.replace(/\/\/.*@/, '//'), extractedAt: new Date().toISOString(), fixtures: index }, null, 1) + '\n');
    console.log('Fixtures per department:', JSON.stringify(summary));
    console.log(`Wrote ${index.length} fixtures to ${OUT}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
