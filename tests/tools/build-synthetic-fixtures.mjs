// Builds the synthetic golden-master fixtures in tests/fixtures/synthetic/ (committed; no real data).
// Run: node tests/tools/build-synthetic-fixtures.mjs
// Each fixture holds raw MongoDB documents as the server stores them: Order (Excel rows in <dept>Items, General
// T&A fields) and OrderDate (saved plans). The mocked server (tests/harness/mock-server.ts) answers from them.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'tests', 'fixtures', 'synthetic');
const CREATED = '2026-09-01T00:00:00.000Z';
const SAVED_AT = '2026-09-10T00:00:00.000Z';
let idSeq = 0;
const oid = (prefix) => `${prefix}${String(++idSeq).padStart(24 - prefix.length, '0')}`;

/* ---------------- documents ---------------- */

function order(orderNo, fields = {}) {
  return {
    _id: oid('a0'),
    orderNo,
    __v: 0,
    bookingBy: 'Booker One',
    bookingDate: 46265,
    buyer: 'Buyer North',
    buyerTeam: 'Team A',
    createdAt: CREATED,
    deliEnd: '2026-11-10',
    deliStart: '2026-10-25',
    dyeEnd: '2026-10-30',
    dyeStart: '2026-10-12',
    eventDay: 'Day 3',
    fabricNotes: `Synthetic order ${orderNo}.`,
    finalConfirmation: 'Yes',
    bpStatus: 'Approved',
    pmc: 'PMC-1',
    style: 'Polo Basic',
    knitEnd: '2026-10-21',
    knitStart: '2026-10-02',
    requiredQtyKgs: '',
    ship1: '2026-12-01',
    shipLast: 'N/A',
    status: 'Running',
    yarnDate: '2026-10-01',
    knittingItems: [],
    dyeingItems: [],
    finishingItems: [],
    deliveryItems: [],
    ydItems: [],
    knittingPlanStatus: 'Pending',
    dyeingPlanStatus: 'Pending',
    finishingPlanStatus: 'Pending',
    deliveryPlanStatus: 'Pending',
    ydPlanStatus: 'Pending',
    updatedAt: CREATED,
    ...fields,
  };
}

function orderDate(orderNo, fields = {}) {
  return {
    _id: oid('b0'),
    orderNo,
    __v: 0,
    createdAt: SAVED_AT,
    knitting: [],
    dyeing: [],
    finishing: [],
    delivery: [],
    yd: [],
    knittingStatus: 'On Process',
    dyeingStatus: 'On Process',
    finishingStatus: 'On Process',
    deliveryStatus: 'On Process',
    ydStatus: 'On Process',
    knittingCompletedDate: null,
    dyeingCompletedDate: null,
    finishingCompletedDate: null,
    deliveryCompletedDate: null,
    ydCompletedDate: null,
    updatedAt: SAVED_AT,
    ...fields,
  };
}

/* ---------------- Excel rows (column names as the uploads store them) ---------------- */

const knitRow = (no, Color, FabricConstruction, GSM, qty, extra = {}) => ({
  OrderNo: no, Color, FabricConstruction, GSM, RequiredQtyKgs: qty, Buyer: 'Buyer North', 'Allowance %': 5,
  'Yarn req.': Math.round(qty * 1.05), 'Allocated Qty ': Math.round(qty / 2), 'Yarn bala.': Math.round(qty * 0.55),
  'Grey Req.': qty + 20, 'Knit Prod.': 100, 'Knit. Bala.': qty - 80, NetReceivedQtyKgs: 0, NetDeliveryQtyKgs: 0,
  RFD: 0, Slowmoving: 0, 'FF Stock': 0, 'Deli. Bala.': qty, ...extra,
});

const deliRow = (no, Color, FabricConstruction, GSM, qty, extra = {}) => ({
  OrderNo: no, Color, FabricConstruction, GSM, RequiredQtyKgs: qty, Buyer: 'Buyer North', 'Allowance %': 5,
  'Grey Req.': qty + 20, 'Knit Prod.': qty, 'Knit. Bala.': 0, NetReceivedQtyKgs: qty - 50, NetDeliveryQtyKgs: qty - 100,
  RFD: 25, Slowmoving: 5, 'FF Stock': 10, 'Deli. Bala.': 100, ...extra,
});

const dyeRow = (no, Color, Unit, processName, qty, extra = {}) => ({
  OrderNo: no, Color, RequiredQtyKgs: qty, Buyer: 'Buyer North', Unit, 'Process Name': processName,
  'Grey Req.': qty + 20, 'Knit Prod.': qty, 'Knit. Bala.': 20, 'BP Qty': qty - 30, 'Dyeing Prod.': 60,
  'Dyeing Bala.': qty - 60, NetReceivedQtyKgs: 0, NetDeliveryQtyKgs: 0, RFD: 0, Slowmoving: 0, 'FF Stock': 0, ...extra,
});

const ydRow = (no, type, YDB, extra = {}) => ({
  'Booking Type': type, 'YD Booking Date': 46270, Buyer: 'Buyer North', 'Booking No.': no, YDB,
  'YD T&A\nStart': '2026-10-03', 'YD T&A\nEnd': '2026-10-12', 'YD REQ.': 120, DYED: 40, 'YD BALANCE': 80,
  'YD DELIVERY REQ.': 120, 'YD DELIVERED': 30, 'YD DELIVERY BALANCE': 90, ...extra,
});

/* ---------------- saved plan items ---------------- */

const plan = (itemId, itemData, startDate, endDate, planType, extra = {}) => ({
  itemId, itemData, startDate, endDate, planType, limitation: '', remarks: '', ...extra,
});

/* ---------------- fixtures ---------------- */

const fixtures = {};

// ---- knitting ----
{
  const no = 'SYN-K1';
  fixtures['knit-basic'] = {
    about:
      "Knitting: row 0 saved Tentative (unlocked for everyone, drives the Row-1 copy-down), row 1 saved Confirm (locked for non-admins), row 2 an end date without start or plan type. General card: Excel-serial booking date, 'N/A' last ship date, empty Order Qty (server fallback: sum of the item quantities).",
    orderNo: no,
    orders: [
      order(no, {
        knittingItems: [knitRow(no, 'Red', 'S/J', 160, 500), knitRow(no, 'Blue', 'S/J', 180, 300), knitRow(no, 'Green', 'Rib', 200, 200)],
        knittingPlanStatus: 'Tentative',
      }),
    ],
    orderDates: [
      orderDate(no, {
        knitting: [
          plan('syn-k1_red_s/j_160', { OrderNo: no, Color: 'Red', FabricConstruction: 'S/J', GSM: 160 }, '2026-10-05', '2026-10-15', 'Tentative', { limitation: 'L-red', remarks: 'R-red', yarnDate: '2026-10-01' }),
          plan('syn-k1_blue_s/j_180', { OrderNo: no, Color: 'Blue', FabricConstruction: 'S/J', GSM: 180 }, '2026-10-06', '2026-10-16', 'Confirm', { yarnDate: '2026-10-01' }),
          plan('syn-k1_green_rib_200', { OrderNo: no, Color: 'Green', FabricConstruction: 'Rib', GSM: 200 }, '', '2026-10-09', ''),
        ],
      }),
    ],
  };
}
{
  const no = 'SYN-K2';
  fixtures['knit-match'] = {
    about:
      "Knitting item matching: a row without GSM whose generated id ends in '_' matched to a saved id without it (row 0), Excel rows with their own itemId (row 1 matched exactly, row 2 matched through its generated id), saved ids with a trailing '_' (row 3, saved Confirm) and '_n/a' (row 4). The saved Dyeing row with row 1's itemId is Confirm (the 'next department' lock).",
    orderNo: no,
    orders: [
      order(no, {
        knittingItems: [
          (() => {
            const r = knitRow(no, 'Navy', 'Pique', 0, 120);
            delete r.GSM;
            return r;
          })(),
          knitRow(no, 'Red', 'S/J', 160, 500, { itemId: 'k2-red-own' }),
          knitRow(no, 'Blue', 'S/J', 180, 300, { itemId: 'k2-blue-own' }),
          knitRow(no, 'Green', 'Rib', 200, 200),
          knitRow(no, 'White', 'Rib', 200, 150),
        ],
      }),
    ],
    orderDates: [
      orderDate(no, {
        knitting: [
          plan('k2-red-own', { OrderNo: no, Color: 'Red', FabricConstruction: 'S/J', GSM: 160 }, '2026-10-05', '2026-10-15', 'Tentative', { yarnDate: '2026-10-01' }),
          plan('syn-k2_blue_s/j_180', { OrderNo: no, Color: 'Blue', FabricConstruction: 'S/J', GSM: 180 }, '2026-10-06', '2026-10-16', 'Tentative', { yarnDate: '2026-10-01' }),
          plan('syn-k2_green_rib_200_', { OrderNo: no, Color: 'Green', FabricConstruction: 'Rib', GSM: 200 }, '2026-10-07', '2026-10-17', 'Confirm', { yarnDate: '2026-10-01' }),
          plan('syn-k2_white_rib_200_n/a', { OrderNo: no, Color: 'White', FabricConstruction: 'Rib', GSM: 200 }, '2026-10-08', '2026-10-18', 'Tentative', { yarnDate: '2026-10-01' }),
          plan('syn-k2_navy_pique', { OrderNo: no, Color: 'Navy', FabricConstruction: 'Pique' }, '2026-10-09', '2026-10-19', 'Tentative', { yarnDate: '2026-10-01' }),
        ],
        dyeing: [plan('k2-red-own', { OrderNo: no, Color: 'Red', Unit: 'EFL', ProcessName: 'Solid' }, '2026-10-16', '2026-10-25', 'Confirm')],
      }),
    ],
  };
}
{
  const no = 'SYN-K3';
  fixtures['knit-legacy'] = {
    about:
      'Knitting rows saved by older code, each failing one save check in table order: row 1 Tentative without End (SAVE-05), row 2 Confirm without Yarn Date (SAVE-06), row 3 Start before Yarn Date (SAVE-07), row 4 Start after End (SAVE-03). The General floor / program type fill Unit and Process Name of every row.',
    orderNo: no,
    orders: [
      order(no, {
        floor: 'Floor-3',
        programType: 'Prog-K',
        knittingItems: [
          knitRow(no, 'Red', 'S/J', 160, 500),
          knitRow(no, 'Blue', 'S/J', 180, 300),
          knitRow(no, 'Green', 'Rib', 200, 200),
          knitRow(no, 'White', 'Rib', 200, 150),
          knitRow(no, 'Navy', 'Pique', 220, 120),
        ],
      }),
    ],
    orderDates: [
      orderDate(no, {
        knitting: [
          plan('syn-k3_red_s/j_160', { Color: 'Red', FabricConstruction: 'S/J' }, '2026-10-05', '2026-10-15', 'Tentative', { yarnDate: '2026-10-01' }),
          plan('syn-k3_blue_s/j_180', { Color: 'Blue', FabricConstruction: 'S/J' }, '2026-10-06', '', 'Tentative', { yarnDate: '2026-10-01' }),
          plan('syn-k3_green_rib_200', { Color: 'Green', FabricConstruction: 'Rib' }, '2026-10-07', '2026-10-17', 'Confirm', { yarnDate: '' }),
          plan('syn-k3_white_rib_200', { Color: 'White', FabricConstruction: 'Rib' }, '2026-09-25', '2026-10-10', 'Tentative', { yarnDate: '2026-10-01' }),
          plan('syn-k3_navy_pique_220', { Color: 'Navy', FabricConstruction: 'Pique' }, '2026-10-12', '2026-10-08', '', { yarnDate: '2026-10-01' }),
        ],
      }),
    ],
  };
}
{
  const no = 'SYN-K4';
  fixtures['knit-floor-legacy'] = {
    about:
      'A knitting row saved with floor dates (an older save): Floor Start after Floor End. The knitting table has no floor inputs, but the save still checks them (SAVE-04) and sends them.',
    orderNo: no,
    orders: [order(no, { knittingItems: [knitRow(no, 'Red', 'S/J', 160, 500)] })],
    orderDates: [
      orderDate(no, {
        knitting: [
          plan('syn-k4_red_s/j_160', { Color: 'Red', FabricConstruction: 'S/J' }, '2026-10-05', '2026-10-15', 'Tentative', {
            yarnDate: '2026-10-01',
            floorStartDate: '2026-10-20',
            floorEndDate: '2026-10-18',
            floorPlanType: 'Confirm',
          }),
        ],
      }),
    ],
  };
}

// ---- dyeing ----
function dyeOrder(no, finalConfirmation) {
  return {
    orders: [
      order(no, {
        finalConfirmation,
        dyeingItems: [
          dyeRow(no, 'Red', 'EFL', 'Solid', 500),
          dyeRow(no, 'Blue', 'EKL', 'HTR', 300),
          dyeRow(no, 'Green', 'EFL', 'Dyeing Wash', 200),
          dyeRow(no, 'White', '', '', 150),
          dyeRow(no, 'Navy', 'Ext', 'Pluvia', 120),
          dyeRow(no, 'Black', 'EFL', 'Solid', 100),
          dyeRow(no, 'Grey', 'EFL', 'Solid', 90),
        ],
        dyeingPlanStatus: 'Pending',
      }),
    ],
    orderDates: [
      orderDate(no, {
        knitting: [
          plan(`${no.toLowerCase()}_red_s/j_160`, { Color: 'Red', FabricConstruction: 'S/J' }, '2026-10-05', '2026-10-15', 'Confirm', { limitation: 'KL-red', remarks: 'KR-red' }),
          plan(`${no.toLowerCase()}_blue_s/j_180`, { Color: 'Blue', FabricConstruction: 'S/J' }, '2026-10-06', '2026-10-16', 'Tentative'),
          plan(`${no.toLowerCase()}_green_rib_200`, { Color: 'Green', FabricConstruction: 'Rib' }, '', '', ''),
          plan(`${no.toLowerCase()}_navy_pique_220`, { Color: 'Navy', FabricConstruction: 'Pique' }, '2026-10-07', '2026-10-17', '-'),
          plan(`${no.toLowerCase()}_black_s/j_160`, { Color: 'Black', FabricConstruction: 'S/J' }, '2026-10-08', '2026-10-18', 'Confirm'),
          plan(`${no.toLowerCase()}_grey_rib_200`, { Color: 'Grey', FabricConstruction: 'Rib' }, '', '', ''),
        ],
        dyeing: [
          plan(`${no.toLowerCase()}_red_solid`, { Color: 'Red', Unit: 'EFL', ProcessName: 'Solid', 'Process Name': 'Solid' }, '2026-10-16', '2026-10-25', 'Tentative', { limitation: 'DL-red' }),
          plan(`${no.toLowerCase()}_green_dyeingwash`, { Color: 'Green', Unit: 'EFL', ProcessName: 'Dyeing Wash', 'Process Name': 'Dyeing Wash' }, '2026-10-19', '2026-10-27', ''),
          plan(`${no.toLowerCase()}_navy_pluvia`, { Color: 'Navy', Unit: 'Ext', ProcessName: 'Pluvia', 'Process Name': 'Pluvia' }, '2026-10-18', '', ''),
          plan(`${no.toLowerCase()}_black_solid`, { Color: 'Black', Unit: 'EFL', ProcessName: 'Solid', 'Process Name': 'Solid' }, '2026-10-20', '2026-10-28', 'Confirm'),
        ],
        dyeingStatus: 'Pending',
      }),
    ],
  };
}
fixtures['dye-basic'] = {
  about:
    "Dyeing against saved Knitting rows (matched by colour): Red knit Confirm, Blue Tentative, Green blank, White none (and no Unit/Process), Navy '-', Black Confirm (dyeing saved Confirm), Grey blank. Green and Navy have saved dyeing dates without a plan type, so they stay editable for non-admins.",
  orderNo: 'SYN-D1',
  ...dyeOrder('SYN-D1', 'Yes'),
};
fixtures['dye-finalno'] = {
  about: "dye-basic with Final Confirmation 'No' in the General file: Dyeing cannot be confirmed (CHG-10), and a date edit drops a saved Confirm.",
  orderNo: 'SYN-D2',
  ...dyeOrder('SYN-D2', 'No'),
};
{
  const no = 'SYN-D3';
  fixtures['dye-legacy'] = {
    about:
      'Dyeing rows saved by older code: row 1 starts before its Knitting start (SAVE-09), row 2 ends before its Knitting end (SAVE-10), row 3 is saved Confirm (SAVE-01 for non-admins once changed).',
    orderNo: no,
    orders: [
      order(no, {
        dyeingItems: [dyeRow(no, 'Red', 'EFL', 'Solid', 500), dyeRow(no, 'Blue', 'EKL', 'HTR', 300), dyeRow(no, 'Black', 'EFL', 'Solid', 100), dyeRow(no, 'Navy', 'Ext', 'Pluvia', 120)],
      }),
    ],
    orderDates: [
      orderDate(no, {
        knitting: [
          plan('syn-d3_red_s/j_160', { Color: 'Red', FabricConstruction: 'S/J' }, '2026-10-05', '2026-10-15', 'Confirm'),
          plan('syn-d3_blue_s/j_180', { Color: 'Blue', FabricConstruction: 'S/J' }, '2026-10-06', '2026-10-16', 'Tentative'),
          plan('syn-d3_black_s/j_160', { Color: 'Black', FabricConstruction: 'S/J' }, '2026-10-08', '2026-10-18', 'Confirm'),
          plan('syn-d3_navy_pique_220', { Color: 'Navy', FabricConstruction: 'Pique' }, '2026-10-07', '2026-10-17', 'Confirm'),
        ],
        dyeing: [
          plan('syn-d3_red_solid', { Color: 'Red', Unit: 'EFL', ProcessName: 'Solid' }, '2026-10-16', '2026-10-25', 'Tentative'),
          plan('syn-d3_blue_htr', { Color: 'Blue', Unit: 'EKL', ProcessName: 'HTR' }, '2026-10-04', '2026-10-20', 'Tentative'),
          plan('syn-d3_black_solid', { Color: 'Black', Unit: 'EFL', ProcessName: 'Solid' }, '2026-10-12', '2026-10-14', 'Tentative'),
          plan('syn-d3_navy_pluvia', { Color: 'Navy', Unit: 'Ext', ProcessName: 'Pluvia' }, '2026-10-21', '2026-10-29', 'Confirm'),
        ],
      }),
    ],
  };
}

// ---- delivery ----
{
  const no = 'SYN-L1';
  const id = no.toLowerCase();
  fixtures['deli-basic'] = {
    about:
      "Delivery against saved Dyeing rows: Red Confirm, Blue Tentative (no saved delivery: Floor defaults +7 days / Tentative), Green blank type (locked for non-admins), White no dyeing, Grey Tentative without dates (main inputs locked for everyone), Navy matched through an itemId containing '_navy_' (saved delivery Confirm, Floor empty so it gets the defaults), Red Rib / Red Pique for the Knitting colour+construction match.",
    orderNo: no,
    orders: [
      order(no, {
        deliveryItems: [
          deliRow(no, 'Red', 'S/J', 160, 500),
          deliRow(no, 'Blue', 'S/J', 180, 300),
          deliRow(no, 'Green', 'Rib', 200, 200),
          deliRow(no, 'White', 'Rib', 200, 150),
          deliRow(no, 'Grey', 'Pique', 220, 90),
          deliRow(no, 'Navy', 'S/J', 160, 120),
          deliRow(no, 'Red', 'Rib', 200, 110),
          deliRow(no, 'Red', 'Pique', 220, 100),
        ],
        deliveryPlanStatus: 'Tentative',
      }),
    ],
    orderDates: [
      orderDate(no, {
        knitting: [
          plan(`${id}_red_s/j_160`, { Color: 'Red', FabricConstruction: 'S/J' }, '2026-10-05', '2026-10-15', 'Confirm'),
          plan(`${id}_red_rib_200`, { Color: 'Red', FabricConstruction: 'Rib' }, '2026-10-09', '2026-10-19', 'Tentative'),
          plan(`${id}_blue_s/j_180`, { Color: 'Blue', FabricConstruction: 'S/J' }, '2026-10-06', '2026-10-16', 'Tentative'),
        ],
        dyeing: [
          plan(`${id}_red_solid`, { Color: 'Red' }, '2026-10-16', '2026-10-25', 'Confirm'),
          plan(`${id}_blue_htr`, { Color: 'Blue' }, '2026-10-17', '2026-10-26', 'Tentative'),
          plan(`${id}_green_solid`, { Color: 'Green' }, '2026-10-18', '', ''),
          plan(`${id}_grey_solid`, { Color: 'Grey' }, '', '', 'Tentative'),
          plan(`${id}_navy_solid`, { Color: 'Navy Blue' }, '2026-10-20', '2026-10-29', 'Confirm'),
        ],
        delivery: [
          plan(`${id}_red_s/j_160`, { Color: 'Red', FabricConstruction: 'S/J' }, '2026-10-26', '2026-11-05', 'Tentative', {
            limitation: 'DLV-red',
            floorStartDate: '2026-10-23',
            floorEndDate: '2026-11-01',
            floorPlanType: 'Tentative',
          }),
          plan(`${id}_navy_s/j_160`, { Color: 'Navy', FabricConstruction: 'S/J' }, '2026-10-27', '2026-11-06', 'Confirm', {
            floorStartDate: '',
            floorEndDate: '',
            floorPlanType: '',
          }),
        ],
        deliveryStatus: 'On Process',
      }),
    ],
  };
}
{
  const no = 'SYN-L2';
  const id = no.toLowerCase();
  fixtures['deli-legacy'] = {
    about: 'Delivery rows saved by older code: row 1 starts before its Dyeing start (SAVE-13), row 2 ends before its Dyeing end (SAVE-14).',
    orderNo: no,
    orders: [order(no, { deliveryItems: [deliRow(no, 'Red', 'S/J', 160, 500), deliRow(no, 'Blue', 'S/J', 180, 300), deliRow(no, 'Green', 'Rib', 200, 200)] })],
    orderDates: [
      orderDate(no, {
        knitting: [
          plan(`${id}_red_s/j_160`, { Color: 'Red', FabricConstruction: 'S/J' }, '2026-10-05', '2026-10-15', 'Confirm'),
          plan(`${id}_blue_s/j_180`, { Color: 'Blue', FabricConstruction: 'S/J' }, '2026-10-06', '2026-10-16', 'Confirm'),
          plan(`${id}_green_rib_200`, { Color: 'Green', FabricConstruction: 'Rib' }, '2026-10-07', '2026-10-17', 'Confirm'),
        ],
        dyeing: [
          plan(`${id}_red_solid`, { Color: 'Red' }, '2026-10-16', '2026-10-25', 'Confirm'),
          plan(`${id}_blue_solid`, { Color: 'Blue' }, '2026-10-17', '2026-10-26', 'Confirm'),
          plan(`${id}_green_solid`, { Color: 'Green' }, '2026-10-18', '2026-10-27', 'Confirm'),
        ],
        delivery: [
          plan(`${id}_red_s/j_160`, { Color: 'Red' }, '2026-10-26', '2026-11-05', 'Tentative', { floorStartDate: '2026-10-23', floorEndDate: '2026-11-01', floorPlanType: 'Tentative' }),
          plan(`${id}_blue_s/j_180`, { Color: 'Blue' }, '2026-10-15', '2026-11-04', 'Tentative', { floorStartDate: '2026-10-24', floorEndDate: '2026-11-02', floorPlanType: 'Tentative' }),
          plan(`${id}_green_rib_200`, { Color: 'Green' }, '2026-10-19', '2026-10-25', 'Tentative', { floorStartDate: '2026-10-25', floorEndDate: '2026-11-03', floorPlanType: 'Tentative' }),
        ],
      }),
    ],
  };
}
{
  const no = 'SYN-L3';
  const id = no.toLowerCase();
  const noColour = deliRow(no, 'X', 'S/J', 160, 80);
  delete noColour.Color;
  fixtures['deli-match'] = {
    about: 'Delivery rows without a colour: an empty colour matches the saved Knitting and Dyeing rows whose colour is empty too.',
    orderNo: no,
    orders: [order(no, { deliveryItems: [deliRow(no, 'Red', 'S/J', 160, 500), noColour] })],
    orderDates: [
      orderDate(no, {
        knitting: [
          plan(`${id}_red_s/j_160`, { Color: 'Red', FabricConstruction: 'S/J' }, '2026-10-05', '2026-10-15', 'Confirm'),
          plan(`${id}__s/j_160`, { Color: '', FabricConstruction: 'S/J' }, '2026-10-07', '2026-10-17', 'Tentative'),
        ],
        dyeing: [
          plan(`${id}_red_solid`, { Color: 'Red' }, '2026-10-16', '2026-10-25', 'Confirm'),
          plan(`${id}__solid`, { Color: '' }, '2026-10-18', '2026-10-27', 'Confirm'),
        ],
      }),
    ],
  };
}

// ---- yd ----
{
  const no = 'SYN-Y1';
  fixtures['yd-basic'] = {
    about:
      "YD rows: row 0 saved Tentative without floor dates (shown as start/end - 4 days), row 1 saved Confirm with hand-entered floor dates and saved Barrier/Workable Qty., row 2 unsaved with an Excel Barrier Qty., row 3 saved under another itemId (matched by YDB). The first saved Knitting row feeds the 'Knit Plan' columns.",
    orderNo: no,
    orders: [
      order(no, {
        ydItems: [ydRow(no, 'Solid', 'YDB-001'), ydRow(no, 'Stripe', 'YDB-002'), ydRow(no, 'Solid', 'YDB-003', { 'Barrier Qty.': 50 }), ydRow(no, 'Solid', 'YDB-004')],
        ydPlanStatus: 'Tentative',
      }),
    ],
    orderDates: [
      orderDate(no, {
        knitting: [plan('syn-y1_red_s/j_160', { Color: 'Red', FabricConstruction: 'S/J' }, '2026-10-05', '2026-10-15', 'Confirm')],
        yd: [
          plan('syn-y1_solid_ydb-001', { YDB: 'YDB-001', 'Booking Type': 'Solid' }, '2026-10-10', '2026-10-20', 'Tentative', {
            limitation: 'YDL',
            remarks: 'YDR',
            yarnOkDate: '2026-10-08',
            matchingOptionDate: '2026-10-09',
          }),
          plan('syn-y1_stripe_ydb-002', { YDB: 'YDB-002', 'Booking Type': 'Stripe', 'Barrier Qty.': '40', 'Workable Qty.': '35' }, '2026-10-12', '2026-10-22', 'Confirm', {
            floorStartDate: '2026-10-01',
            floorEndDate: '2026-10-05',
            floorPlanType: 'Confirm',
          }),
          plan('legacy-ydb-004', { YDB: 'YDB-004', 'Booking Type': 'Solid' }, '2026-10-14', '2026-10-24', 'Tentative'),
        ],
        ydStatus: 'On Process',
      }),
    ],
  };
}
{
  const no = 'SYN-Y2';
  fixtures['yd-noknit'] = {
    about: "YD without a saved Knitting plan: the 'Knit Plan' columns fall back to the General Knit T&A (an 'N/A' end shows as blank).",
    orderNo: no,
    orders: [order(no, { knitEnd: 'N/A', ydItems: [ydRow(no, 'Solid', 'YDB-101')] })],
    orderDates: [],
  };
}

// ---- finishing ----
{
  const no = 'SYN-F1';
  fixtures['fin-basic'] = {
    about:
      'Finishing: row 0 saved Tentative; row 1 without Unit/Process in Excel (General floor / program type fill them, Unit not in the master list); row 2 saved Confirm under an old itemId (matched by colour); row 3 a second Red row that takes row 0\'s saved plan (and its saved Unit/Process).',
    orderNo: no,
    orders: [
      order(no, {
        floor: 'Floor-2',
        programType: 'Prog-A',
        finishingItems: [dyeRow(no, 'Red', 'EFL', 'Solid', 500), dyeRow(no, 'Blue', '', '', 300), dyeRow(no, 'Green', 'EKL', 'HTR', 200), dyeRow(no, 'Red', 'EKL', 'HTR', 100)],
      }),
    ],
    orderDates: [
      orderDate(no, {
        finishing: [
          plan('syn-f1_red_solid', { Color: 'Red', Unit: 'EFL', ProcessName: 'Solid', 'Process Name': 'Solid' }, '2026-11-01', '2026-11-05', 'Tentative'),
          plan('old_green_xyz', { Color: 'Green', Unit: 'EKL', ProcessName: 'HTR' }, '2026-11-02', '2026-11-03', 'Confirm'),
        ],
      }),
    ],
  };
}
{
  const no = 'SYN-F2';
  fixtures['fin-confirm'] = {
    about: 'Finishing row saved Confirm under its exact itemId: never disabled, but a non-admin change is refused at save (SAVE-01).',
    orderNo: no,
    orders: [order(no, { finishingItems: [dyeRow(no, 'Red', 'EFL', 'Solid', 500)] })],
    orderDates: [orderDate(no, { finishing: [plan('syn-f2_red_solid', { Color: 'Red', Unit: 'EFL', ProcessName: 'Solid' }, '2026-11-01', '2026-11-05', 'Confirm')] })],
  };
}

// ---- one small fixture per department for the department-independent rules ----
// Row 0 Tentative 10-10..10-30, row 1 Tentative 10-12..10-14, row 2 Tentative from 10-15 without an end
// (saved by older code). Upstream plans (where a department has them) are Confirm 10-01..10-08, so no
// cross-department rule interferes and every row is editable for every role.
{
  const no = 'SYN-GK';
  const id = no.toLowerCase();
  fixtures['gen-knitting'] = {
    about: 'Generic script, knitting: three editable rows, row 2 saved Tentative without an end date.',
    orderNo: no,
    orders: [order(no, { knittingItems: [knitRow(no, 'Red', 'S/J', 160, 500), knitRow(no, 'Blue', 'S/J', 180, 300), knitRow(no, 'Green', 'Rib', 200, 200)] })],
    orderDates: [
      orderDate(no, {
        knitting: [
          plan(`${id}_red_s/j_160`, { Color: 'Red' }, '2026-10-10', '2026-10-30', 'Tentative', { yarnDate: '2026-10-01' }),
          plan(`${id}_blue_s/j_180`, { Color: 'Blue' }, '2026-10-12', '2026-10-14', 'Tentative', { yarnDate: '2026-10-01' }),
          plan(`${id}_green_rib_200`, { Color: 'Green' }, '2026-10-15', '', 'Tentative', { yarnDate: '2026-10-01' }),
        ],
      }),
    ],
  };
}
{
  const no = 'SYN-GD';
  const id = no.toLowerCase();
  fixtures['gen-dyeing'] = {
    about: 'Generic script, dyeing: three editable rows (row 1 saved under an old itemId, matched by colour), Knitting Confirm 10-01..10-08.',
    orderNo: no,
    orders: [order(no, { dyeingItems: [dyeRow(no, 'Red', 'EFL', 'Solid', 500), dyeRow(no, 'Blue', 'EKL', 'Pluvia', 300), dyeRow(no, 'Green', 'EFL', 'Solid', 200)] })],
    orderDates: [
      orderDate(no, {
        knitting: [
          plan(`${id}_red_s/j_160`, { Color: 'Red', FabricConstruction: 'S/J' }, '2026-10-01', '2026-10-08', 'Confirm'),
          plan(`${id}_blue_s/j_180`, { Color: 'Blue', FabricConstruction: 'S/J' }, '2026-10-01', '2026-10-08', 'Confirm'),
          plan(`${id}_green_rib_200`, { Color: 'Green', FabricConstruction: 'Rib' }, '2026-10-01', '2026-10-08', 'Confirm'),
        ],
        dyeing: [
          plan(`${id}_red_solid`, { Color: 'Red', Unit: 'EFL', ProcessName: 'Solid' }, '2026-10-10', '2026-10-30', 'Tentative'),
          plan('old-dye-blue', { Color: 'Blue', Unit: 'EKL', ProcessName: 'Pluvia' }, '2026-10-12', '2026-10-14', 'Tentative'),
          plan(`${id}_green_solid`, { Color: 'Green', Unit: 'EFL', ProcessName: 'Solid' }, '2026-10-15', '', 'Tentative'),
        ],
      }),
    ],
  };
}
{
  const no = 'SYN-GL';
  const id = no.toLowerCase();
  fixtures['gen-delivery'] = {
    about:
      "Generic script, delivery: three editable rows (row 1 saved under its id plus a trailing '_' and without floor dates, so it gets the +7 day defaults), Dyeing Confirm 10-01..10-08.",
    orderNo: no,
    orders: [order(no, { deliveryItems: [deliRow(no, 'Red', 'S/J', 160, 500), deliRow(no, 'Blue', 'S/J', 180, 300), deliRow(no, 'Green', 'Rib', 200, 200)] })],
    orderDates: [
      orderDate(no, {
        knitting: [
          plan(`${id}_red_s/j_160`, { Color: 'Red', FabricConstruction: 'S/J' }, '2026-09-25', '2026-09-30', 'Confirm'),
          plan(`${id}_blue_s/j_180`, { Color: 'Blue', FabricConstruction: 'S/J' }, '2026-09-25', '2026-09-30', 'Confirm'),
          plan(`${id}_green_rib_200`, { Color: 'Green', FabricConstruction: 'Rib' }, '2026-09-25', '2026-09-30', 'Confirm'),
        ],
        dyeing: [
          plan(`${id}_red_solid`, { Color: 'Red' }, '2026-10-01', '2026-10-08', 'Confirm'),
          plan(`${id}_blue_solid`, { Color: 'Blue' }, '2026-10-01', '2026-10-08', 'Confirm'),
          plan(`${id}_green_solid`, { Color: 'Green' }, '2026-10-01', '2026-10-08', 'Confirm'),
        ],
        delivery: [
          plan(`${id}_red_s/j_160`, { Color: 'Red' }, '2026-10-10', '2026-10-30', 'Tentative', { floorStartDate: '2026-10-08', floorEndDate: '2026-10-15', floorPlanType: 'Tentative' }),
          plan(`${id}_blue_s/j_180_`, { Color: 'Blue' }, '2026-10-12', '2026-10-14', 'Tentative'),
          plan(`${id}_green_rib_200`, { Color: 'Green' }, '2026-10-15', '', 'Tentative', { floorStartDate: '2026-10-08', floorEndDate: '2026-10-15', floorPlanType: 'Tentative' }),
        ],
      }),
    ],
  };
}
{
  const no = 'SYN-GY';
  const id = no.toLowerCase();
  fixtures['gen-yd'] = {
    about: 'Generic script, YD: three editable rows without floor dates (shown as plan dates - 4 days).',
    orderNo: no,
    orders: [order(no, { ydItems: [ydRow(no, 'Solid', 'YDB-201'), ydRow(no, 'Stripe', 'YDB-202'), ydRow(no, 'Solid', 'YDB-203')] })],
    orderDates: [
      orderDate(no, {
        yd: [
          plan(`${id}_solid_ydb-201`, { YDB: 'YDB-201' }, '2026-10-10', '2026-10-30', 'Tentative'),
          plan(`${id}_stripe_ydb-202`, { YDB: 'YDB-202' }, '2026-10-12', '2026-10-14', 'Tentative'),
          plan(`${id}_solid_ydb-203`, { YDB: 'YDB-203' }, '2026-10-15', '', 'Tentative'),
        ],
      }),
    ],
  };
}
{
  const no = 'SYN-GF';
  const id = no.toLowerCase();
  fixtures['gen-finishing'] = {
    about: 'Generic script, finishing: three editable rows.',
    orderNo: no,
    orders: [order(no, { finishingItems: [dyeRow(no, 'Red', 'EFL', 'Solid', 500), dyeRow(no, 'Blue', 'EKL', 'Pluvia', 300), dyeRow(no, 'Green', 'EFL', 'Solid', 200)] })],
    orderDates: [
      orderDate(no, {
        finishing: [
          plan(`${id}_red_solid`, { Color: 'Red', Unit: 'EFL', ProcessName: 'Solid' }, '2026-10-10', '2026-10-30', 'Tentative'),
          plan(`${id}_blue_pluvia`, { Color: 'Blue', Unit: 'EKL', ProcessName: 'Pluvia' }, '2026-10-12', '2026-10-14', 'Tentative'),
          plan(`${id}_green_solid`, { Color: 'Green', Unit: 'EFL', ProcessName: 'Solid' }, '2026-10-15', '', 'Tentative'),
        ],
      }),
    ],
  };
}

// ---- no items ----
fixtures['empty-order'] = {
  about: 'An order from the General file only: no department rows, no saved plans (SAVE-00 and the empty table).',
  orderNo: 'SYN-E1',
  orders: [order('SYN-E1', { requiredQtyKgs: 750 })],
  orderDates: [],
};

/* ---------------- write ---------------- */

const isPrimitive = (v) => v === null || typeof v !== 'object';
function formatJson(value, indent = '') {
  if (isPrimitive(value)) return JSON.stringify(value);
  const inline = JSON.stringify(value);
  if (inline.length + indent.length <= 120) return inline;
  const values = Array.isArray(value) ? value : Object.values(value);
  if (values.every(isPrimitive)) return inline;
  const inner = indent + '  ';
  if (Array.isArray(value)) return `[\n${value.map((v) => inner + formatJson(v, inner)).join(',\n')}\n${indent}]`;
  const entries = Object.keys(value).map((k) => `${inner}${JSON.stringify(k)}: ${formatJson(value[k], inner)}`);
  return `{\n${entries.join(',\n')}\n${indent}}`;
}

for (const [name, fixture] of Object.entries(fixtures)) {
  writeFileSync(join(OUT, `${name}.json`), formatJson(fixture) + '\n');
}
console.log(`wrote ${Object.keys(fixtures).length} fixtures to ${OUT}`);
