import assert from 'node:assert/strict';
import test from 'node:test';
import cjClient from './cj-client';
import { CJProductsService } from './cj-products';

const LIST_ID = '1405403151636500480';

const listV2Payload = {
  code: 200,
  message: 'Success',
  data: {
    pageSize: 1,
    pageNumber: 1,
    totalRecords: 1,
    totalPages: 1,
    content: [
      {
        productList: [
          {
            id: LIST_ID,
            nameEn: 'Student Korean Version Of Simple Ladies Small Exquisite Temperament Fashion Watch',
            bigImage: 'https://cf.cjdropshipping.com/1623908807537.jpg',
            sellPrice: '2.63',
            categoryId: 'DAE17D16-A15F-445D-AE34-B698F3290E56',
            threeCategoryName: 'Creative Watches',
            warehouseInventoryNum: 190536,
            deliveryCycle: '',
          },
        ],
        relatedCategoryList: [],
      },
    ],
  },
};

/** Raw POST /product/productDetail/query payload captured from the live CJ API. */
const detailPayload = {
  code: 200,
  message: 'Success',
  data: {
    id: LIST_ID,
    name: '小众设计小香手表',
    nameen: 'Student Korean Version Of Simple Ladies Small Exquisite Temperament Fashion Watch',
    sku: 'CJCY1178129',
    bigimg: 'https://cf.cjdropshipping.com/1623908807537.jpg',
    img: 'https://cf.cjdropshipping.com/1623908807537.jpg,https://cf.cjdropshipping.com/1623908807843.jpg',
    newImgList: [
      'https://cf.cjdropshipping.com/1623908807537.jpg',
      'https://cf.cjdropshipping.com/1623908807843.jpg',
      'https://cf.cjdropshipping.com/1623908841503.jpg',
    ],
    sellprice: '2.63',
    currency: null,
    description: '<p>Product information</p>',
    category: 'Jewelry & Watches > Womens Watches > Creative Watches',
    categoryid: 'DAE17D16-A15F-445D-AE34-B698F3290E56',
    stanProducts: [
      { id: '1405403153129672704', sku: 'CJCY117812901AZ', sellprice: '2.63', variantkey: '1 Style' },
      { id: '1405403153138061312', sku: 'CJCY117812902BY', sellprice: '2.63', variantkey: '2 Style' },
    ],
    variantInventory: [
      {
        vid: '1405403153129672704',
        inventory: [{ countryCode: 'CN', totalInventory: 31756 }],
      },
      {
        vid: '1405403153138061312',
        inventory: [{ countryCode: 'CN', totalInventory: 42 }],
      },
    ],
    thirdVideoList: null,
  },
};

interface Recorded {
  url: string;
  body?: any;
}

function installTransport(payloadFor: (url: string, body?: any) => unknown): Recorded[] {
  const recorded: Recorded[] = [];
  cjClient.setTransportHooks({
    headers: async () => ({}),
    sleep: async () => undefined,
    fetch: async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      recorded.push({ url, body });
      const payload = payloadFor(url, body);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => payload,
        headers: { get: () => null },
      } as unknown as Response;
    },
  });
  return recorded;
}

test.afterEach(() => {
  cjClient.resetTransportHooks();
});

test('listV2 identifier is passed through to the detail endpoint as `id`', async () => {
  const service = new CJProductsService();
  const recorded = installTransport(url =>
    url.includes('/product/listV2') ? listV2Payload : detailPayload
  );

  const list = await service.searchProducts({ page: 1, pageSize: 1 });
  assert.equal(list.list.length, 1);

  const listId = list.list[0].id;
  assert.equal(listId, LIST_ID);

  const detail = await service.getProductDetail(listId);

  const detailCall = recorded.find(r => r.url.includes('/product/productDetail/query'));
  assert.ok(detailCall, 'detail endpoint must be called');
  const sentBody: any = detailCall!.body;
  assert.equal(sentBody.pid, undefined, 'the legacy `pid` field must not be sent');
  assert.deepEqual(sentBody, { id: listId }, 'body must be { id } with the listV2 id');
  assert.equal(detail.pid, listId, 'no id conversion happens');
});

test('successful product detail request normalises name, images, price, variants and stock', async () => {
  const service = new CJProductsService();
  installTransport(() => detailPayload);

  const detail = await service.getProductDetail(LIST_ID);

  assert.equal(detail.pid, LIST_ID);
  assert.match(detail.productName, /Student Korean Version/);
  assert.equal(detail.productDesc, '<p>Product information</p>');
  assert.equal(detail.productImages.length, 3);
  assert.equal(detail.productImage, 'https://cf.cjdropshipping.com/1623908807537.jpg');
  assert.equal(detail.productPrice, 2.63);
  assert.equal(detail.currency, 'USD');
  assert.equal(detail.categoryId, 'DAE17D16-A15F-445D-AE34-B698F3290E56');
  assert.equal(detail.categoryPath, 'Jewelry & Watches > Womens Watches > Creative Watches');
  assert.equal(detail.variants!.length, 2);
  assert.equal(detail.variants![0].vid, '1405403153129672704');
  assert.equal(detail.variants![0].sku, 'CJCY117812901AZ');
  assert.equal(detail.variants![0].price, 2.63);
  assert.equal(detail.variants![0].stock, 31756);
  assert.equal(detail.variantStock!['1405403153138061312'], 42);
  assert.equal(detail.availableStock, 31798);
});

test('normalised detail keeps the CJ identity used for EMART duplicate detection', async () => {
  const service = new CJProductsService();
  installTransport(() => detailPayload);

  const detail = await service.getProductDetail(LIST_ID);
  const normalized = service.normalizeProductForDetail(detail);

  assert.equal(normalized.id, LIST_ID);
  assert.equal(normalized.images.length, 3);
  assert.equal(normalized.variants.length, 2);
  assert.equal(normalized.variants[0].stock, 31756);
  assert.equal(normalized.variants[1].stock, 42);
  assert.equal(normalized.stock, 31798);
});

test('getVariants handles the bare-array payload returned by CJ', async () => {
  const service = new CJProductsService();
  installTransport(() => ({
    code: 200,
    message: 'Success',
    data: [
      {
        vid: '1405403153129672704',
        variantSku: 'CJCY117812901AZ',
        variantSellPrice: '2.63',
        variantKey: '1 Style',
        inventoryNum: null,
      },
    ],
  }));

  const variants = await service.getVariants(LIST_ID);
  assert.equal(variants.length, 1);
  assert.equal(variants[0].vid, '1405403153129672704');
  assert.equal(variants[0].sku, 'CJCY117812901AZ');
  assert.equal(variants[0].price, 2.63);
  assert.equal(variants[0].stock, 0);
  assert.equal(variants[0].attrs[0].attrValue, '1 Style');
});

test('getStock reads totalInventoryNum from the bare-array payload', async () => {
  const service = new CJProductsService();
  installTransport(() => ({
    code: 200,
    message: 'Success',
    data: [
      { vid: '1405403153129672704', totalInventoryNum: 31756, stock: [] },
    ],
  }));

  const stock = await service.getStock(['1405403153129672704']);
  assert.deepEqual(stock, { '1405403153129672704': 31756 });
});

test('variant and stock fallbacks are only used when the detail omits them', async () => {
  const service = new CJProductsService();
  const noStockDetail = {
    ...detailPayload,
    data: { ...detailPayload.data, variantInventory: null },
  };
  installTransport(url => {
    if (url.includes('productDetail/query')) return noStockDetail;
    if (url.includes('variant/query')) {
      return { code: 200, message: 'Success', data: [] };
    }
    return { code: 200, message: 'Success', data: [] };
  });

  const detail = await service.getProductDetail(LIST_ID);
  assert.equal(detail.variantStock, null);
  assert.equal(detail.availableStock, 0);
});

test('categoryId is passed to listV2 verbatim so the category filter is never dropped', async () => {
  const service = new CJProductsService();
  const recorded = installTransport(() => listV2Payload);

  // UUID category ids: Number() would produce NaN and silently remove the filter
  await service.searchProducts({ page: 1, pageSize: 1, categoryId: '591E8920-019B-42FA-AE0B-420052E6C4F0' });
  const uuidCall = recorded.find(r => r.url.includes('/product/listV2'))!;
  assert.ok(uuidCall.url.includes('categoryId=591E8920-019B-42FA-AE0B-420052E6C4F0'));
  assert.ok(!uuidCall.url.includes('NaN'), 'UUID must never be coerced to NaN');

  // 19-digit numeric category ids: Number() would lose precision
  recorded.length = 0;
  await service.searchProducts({ page: 1, pageSize: 1, categoryId: '2502190343061609600' });
  const numericCall = recorded.find(r => r.url.includes('/product/listV2'))!;
  assert.ok(
    numericCall.url.includes('categoryId=2502190343061609600'),
    `numeric id must not be rounded, got ${decodeURIComponent(numericCall.url)}`
  );
});
