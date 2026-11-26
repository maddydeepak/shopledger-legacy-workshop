var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function order(items, coupon, ledger) {
  return {
    id: ledger.id,
    date: '01/04/2022',
    customer: 'Test customer',
    items: items,
    coupon: coupon,
    subtotal: ledger.subtotal,
    discount: ledger.discount,
    tax: ledger.tax,
    total: ledger.total
  };
}

var save10Items = [
  { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
  { id: 2, name: 'Sunflower Oil', hsn: '1512', price: 190, qty: 2 }
];

var cappedSave10Items = [
  { id: 3, name: 'Groundnut Oil', hsn: '1508', price: 1120, qty: 2 }
];

var mixedRateItems = [
  { id: 4, name: 'Ghee', hsn: '0405', price: 450, qty: 2 },
  { id: 5, name: 'Sunflower Oil', hsn: '1512', price: 190, qty: 2 }
];

test('CURRENT BEHAVIOUR: checkout prices SAVE10 before GST using HSN rates', function () {
  var totals = pricing.computeTotals(save10Items, 'SAVE10');

  assert.deepEqual(totals, {
    subtotal: 1020,
    discount: 102,
    taxable: 918,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 640, discount: 64, taxable: 576, tax: 28.8, net: 604.8 },
      { id: 2, name: 'Sunflower Oil', hsn: '1512', gstPercent: 5, gross: 380, discount: 38, taxable: 342, tax: 17.1, net: 359.1 }
    ]
  });
});

test('invoice matches checkout HSN rates and SAVE10 discounting', function () {
  var checkout = pricing.computeTotals(save10Items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order(save10Items, 'SAVE10', {
    id: 1002, subtotal: 1020, discount: 102, tax: 45.9, total: 963.9
  }));

  assert.deepEqual(figures, {
    subtotal: 1020,
    discount: checkout.discount,
    tax: checkout.tax,
    cgst: checkout.cgst,
    sgst: checkout.sgst,
    total: checkout.total,
    rows: [
      { name: 'Rice', sku: '-', hsn: '1006', qty: 1, price: 640, gstPercent: 5, line: 640, lineTax: 28.8 },
      { name: 'Sunflower Oil', sku: '-', hsn: '1512', qty: 2, price: 190, gstPercent: 5, line: 380, lineTax: 17.1 }
    ]
  });
});

test('invoice applies the configured SAVE10 discount cap', function () {
  var checkout = pricing.computeTotals(cappedSave10Items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order(cappedSave10Items, 'SAVE10', {
    id: 1004,
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    tax: checkout.tax,
    total: checkout.total
  }));

  assert.equal(checkout.discount, 150);
  assert.equal(checkout.tax, 104.5);
  assert.equal(checkout.total, 2194.5);
  assert.equal(figures.discount, checkout.discount);
  assert.equal(figures.tax, checkout.tax);
  assert.equal(figures.total, checkout.total);
});

test('invoice applies HSN GST to non-coupon items without gstRate', function () {
  var checkout = pricing.computeTotals(mixedRateItems, '');
  var figures = invoice.computeInvoiceFigures(order(mixedRateItems, '', {
    id: 1007,
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    tax: checkout.tax,
    total: checkout.total
  }));

  assert.equal(checkout.tax, 127);
  assert.equal(checkout.total, 1407);
  assert.equal(figures.tax, checkout.tax);
  assert.equal(figures.total, checkout.total);
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [12, 5]);
});

test('GST reconciliation reports matching invoice and checkout figures', function () {
  var checkout = pricing.computeTotals(save10Items, 'SAVE10');
  var result = reports.getGstReconciliation({
    orders: [order(save10Items, 'SAVE10', {
      id: 1002,
      subtotal: checkout.subtotal,
      discount: checkout.discount,
      tax: checkout.tax,
      total: checkout.total
    })],
    products: [],
    customers: []
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 1002,
    date: '01/04/2022',
    customer: 'Test customer',
    coupon: 'SAVE10',
    ledgerSubtotal: 1020,
    ledgerDiscount: 102,
    ledgerTax: 45.9,
    ledgerTotal: 963.9,
    invoiceDiscount: 102,
    invoiceTax: 45.9,
    invoiceTotal: 963.9,
    delta: 0,
    matched: true
  });
});
