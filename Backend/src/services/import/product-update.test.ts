import assert from 'node:assert/strict';
import test from 'node:test';
import { CsvParseError, parseCsv } from './csv-parser';
import { IMPORT_COLUMNS } from './import-columns';
import { validateRows } from './product-row.validator';
import { getFailedRowsForRetry } from './product-import.service';

const category = (input: string) => input.toLowerCase() === 'electronics'
  ? { resolved: true, categoryId: 'category-1', categoryName: 'Electronics' }
  : { resolved: false };

test('CREATE keeps its strict canonical header requirement', () => {
  assert.throws(() => parseCsv('sku,name\nEM-001,Name', 'CREATE'), CsvParseError);
});

test('UPDATE accepts reduced headers and preserves absent/defaulted fields', () => {
  const parsed = parseCsv('sku,name\n em-001 , Updated product ', 'UPDATE');
  const [row] = validateRows(parsed.rows, category, 'UPDATE');
  assert.equal(row.status, 'WARNING');
  assert.equal(row.sku, 'EM-001');
  assert.deepEqual(row.values, { name: 'Updated product' });
  assert.equal('price' in row.values, false);
  assert.equal('estimatedPriceUsd' in row.values, false);
  assert.equal('serviceFee' in row.values, false);
});

test('UPDATE requires a sku header and a sku cell', () => {
  assert.throws(() => parseCsv('name\nUpdated product', 'UPDATE'), CsvParseError);
  const parsed = parseCsv('sku,name\n,Updated product', 'UPDATE');
  assert.match(validateRows(parsed.rows, category, 'UPDATE')[0].errors.join(' '), /SKU is required/);
});

test('UPDATE validates supplied values without mutating omitted values', () => {
  const parsed = parseCsv('sku,price,category\nEM-001,-1,Unknown', 'UPDATE');
  const [row] = validateRows(parsed.rows, category, 'UPDATE');
  assert.equal(row.status, 'ERROR');
  assert.match(row.errors.join(' '), /Price must be a positive number/);
  assert.match(row.errors.join(' '), /Unknown category/);
  assert.deepEqual(row.values, {});
});

test('UPDATE duplicate SKUs are deterministic: only later rows fail', () => {
  const parsed = parseCsv('sku,name\nEM-001,First name\nEM-001,Second name', 'UPDATE');
  const rows = validateRows(parsed.rows, category, 'UPDATE');
  assert.notEqual(rows[0].status, 'ERROR');
  assert.match(rows[1].errors.join(' '), /Duplicate SKU/);
});

test('CREATE still validates a complete canonical row', () => {
  const values: Record<string, string> = {
    sku: 'EM-001', name: 'Valid product', description: 'Description', price: '100', estimatedPriceUsd: '',
    condition: 'NEW', seller: 'Seller', sellerType: 'SHOP', source: 'Source', domesticShipping: '10',
    internationalShippingUsd: '2', serviceFee: '', category: 'Electronics', tags: 'tag', isNew: 'false',
    isBestSeller: 'false', stock: '1', isAvailable: 'true', image1: '', image2: '', image3: '', image4: '', image5: '',
  };
  const csv = `${IMPORT_COLUMNS.join(',')}\n${IMPORT_COLUMNS.map((column) => values[column]).join(',')}`;
  const [row] = validateRows(parseCsv(csv, 'CREATE').rows, category, 'CREATE');
  assert.notEqual(row.status, 'ERROR');
  assert.equal(row.values.estimatedPriceUsd, 0.7);
  assert.equal(row.values.serviceFee, 7);
});

test('failed-row retry helper only selects previously failed rows', () => {
  const sourceRows = [
    { rowNumber: 2, cells: { sku: 'EM-001', name: 'Retry me' }, suppliedColumns: ['sku', 'name'] },
    { rowNumber: 3, cells: { sku: 'EM-002', name: 'Keep me' }, suppliedColumns: ['sku', 'name'] },
    { rowNumber: 5, cells: { sku: 'EM-003', name: 'Failed too' }, suppliedColumns: ['sku', 'name'] },
  ];
  const rowResults = [
    { rowNumber: 2, status: 'FAILED', errors: ['bad'], warnings: [] },
    { rowNumber: 3, status: 'CREATED', errors: [], warnings: [] },
    { rowNumber: 5, status: 'WARNING_UPDATED', errors: [], warnings: ['soft'] },
  ];

  const retryRows = getFailedRowsForRetry(sourceRows, rowResults);
  assert.deepEqual(retryRows.map((row) => row.rowNumber), [2]);
});
