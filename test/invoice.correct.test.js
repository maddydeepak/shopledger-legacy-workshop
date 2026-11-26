var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice matches checkout figures for an HSN-rated SAVE10 order', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Sunflower Oil', hsn: '1512', price: 190, qty: 2 }
  ];
  var checkout = pricing.computeTotals(items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(figures.discount, checkout.discount);
  assert.equal(figures.tax, checkout.tax);
  assert.equal(figures.total, checkout.total);
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 5]);
});
