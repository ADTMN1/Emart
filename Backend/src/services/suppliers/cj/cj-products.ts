import cjClient from './cj-client';

interface CJProductListItem {
  id: string;
  nameEn: string;
  bigImage: string;
  sellPrice: string;
  categoryId: string;
  threeCategoryName: string;
  warehouseInventoryNum: number;
  deliveryCycle: string;
}

interface CJProductListData {
  pageSize: number;
  pageNumber: number;
  totalRecords: number;
  totalPages: number;
  content: Array<{
    productList: CJProductListItem[];
    relatedCategoryList: Array<{
      categoryId: string;
      categoryName: string;
    }>;
  }>;
}

interface CJProductListResponse {
  total: number;
  page: number;
  pageSize: number;
  list: CJProductListItem[];
}

interface CJProductDetail {
  pid: string;
  productName: string;
  productDesc: string;
  productImage: string;
  productImages: string[];
  productPrice: number;
  currency: string;
  categoryId: string | number;
  categoryName: string;
  categoryPath: string;
  warehouse: string;
  shippingTime: string;
  availableStock: number;
  videoUrl?: string;
  attrs?: CJProductAttribute[];
  variants?: CJVariant[];
  variantStock?: Record<string, number> | null;
}

/**
 * Raw shape returned by POST /product/productDetail/query.
 * CJ's detail payload uses its own legacy field names (nameen / sellprice /
 * newImgList / stanProducts) which are unrelated to the listV2 payload.
 */
interface CJProductDetailRaw {
  id?: string;
  name?: string;
  nameen?: string;
  sku?: string;
  bigimg?: string;
  img?: string;
  newImgList?: string[] | null;
  sellprice?: string | number;
  currency?: string | null;
  description?: string;
  category?: string;
  categoryid?: string;
  property?: string | null;
  propertyen?: string | null;
  stanProducts?: Array<{
    id?: string;
    pid?: string;
    sku?: string;
    sellprice?: string | number;
    variantkey?: string;
    variantKey?: string;
    img?: string;
    nameen?: string;
  }> | null;
  variantInventory?: Array<{
    vid?: string;
    inventory?: Array<{ countryCode?: string; totalInventory?: number }> | null;
  }> | null;
  thirdVideoList?: Array<{ url?: string }> | null;
}

/** Raw shape returned by GET /product/variant/query (a bare array). */
interface CJVariantRaw {
  vid?: string;
  id?: string;
  sku?: string;
  variantSku?: string;
  price?: number | string;
  variantSellPrice?: string | number;
  sellprice?: string | number;
  stock?: number;
  inventoryNum?: number;
  variantKey?: string;
  variantkey?: string;
  attrs?: CJVariant['attrs'];
}

/** Raw shape returned by GET /product/stock/queryByVid (a bare array). */
interface CJStockRaw {
  vid?: string;
  totalInventoryNum?: number;
  storageNum?: number;
  stock?: unknown;
}

interface CJProductAttribute {
  attrId: number;
  attrName: string;
  attrValues: CJAttributeValue[];
}

interface CJAttributeValue {
  vid: string;
  value: string;
  image?: string;
  price?: number;
  stock?: number;
  sku?: string;
}

interface CJVariant {
  vid: string;
  sku: string;
  price: number;
  stock: number;
  attrs: Array<{
    attrId: number;
    attrValueId: number;
    attrName: string;
    attrValue: string;
  }>;
}

interface CJStockResponse {
  vid: string;
  stock: number;
}

interface CJCategory {
  categoryId: string;
  categoryName: string;
  parentId?: number;
  level?: number;
}

interface CJCategoryResponse {
  categoryFirstName: string;
  categoryFirstList: Array<{
    categorySecondName: string;
    categorySecondList: Array<{
      categoryId: string;
      categoryName: string;
    }>;
  }>;
}

export class CJProductsService {
  async searchProducts(params: {
    keyword?: string;
    page?: number;
    pageSize?: number;
    categoryId?: string | number;
    warehouse?: string;
  }): Promise<CJProductListResponse> {
    const queryParams: Record<string, string | number | undefined> = {
      page: params.page || 1,
      size: params.pageSize || 20,
    };

    if (params.keyword) queryParams.keyWord = params.keyword;
    // CJ category ids are either UUIDs or 19-digit numerics: never coerce them
    // through Number(), which turns UUIDs into NaN (silently dropping the
    // filter) and loses precision on the numeric form.
    if (params.categoryId !== undefined && params.categoryId !== null && params.categoryId !== '') {
      queryParams.categoryId = String(params.categoryId);
    }
    if (params.warehouse) queryParams.countryCode = params.warehouse;

    const data = await cjClient.get<CJProductListData>('/product/listV2', queryParams);

    const products = data.content?.[0]?.productList || [];

    return {
      total: data.totalRecords || 0,
      page: data.pageNumber || 1,
      pageSize: data.pageSize || 20,
      list: products,
    };
  }

  /**
   * POST /product/productDetail/query requires the body field `id`
   * (CJ returns 400 "id can not be empty" for `{ pid }`). The value is the
   * same identifier listV2 exposes as `id` — no conversion is performed.
   */
  async getProductDetail(pid: string): Promise<CJProductDetail> {
    const raw = await cjClient.post<CJProductDetailRaw>('/product/productDetail/query', {
      id: String(pid),
    });
    return this.normalizeProductDetailResponse(raw, pid);
  }

  async getProductQuery(pid: string): Promise<CJProductDetail> {
    const data = await cjClient.get<CJProductDetail>('/product/query', { pid });
    return data;
  }

  async getVariants(pid: string): Promise<CJVariant[]> {
    const data = await cjClient.get<CJVariantRaw[] | { list: CJVariantRaw[] }>(
      '/product/variant/query',
      { pid }
    );
    const list = Array.isArray(data) ? data : data?.list || [];
    return list.map(raw => this.normalizeVariantResponse(raw));
  }

  async getStock(vids: string[]): Promise<Record<string, number>> {
    if (vids.length === 0) return {};

    const results: Record<string, number> = {};

    for (const vid of vids) {
      try {
        const data = await cjClient.get<CJStockRaw[] | CJStockRaw>('/product/stock/queryByVid', {
          vid,
        });
        const items = Array.isArray(data) ? data : data ? [data] : [];
        results[vid] = items.reduce(
          (sum, item) => sum + (Number(item?.totalInventoryNum ?? item?.storageNum) || 0),
          0
        );
      } catch {
        results[vid] = 0;
      }
    }

    return results;
  }

  async getCategories(): Promise<CJCategory[]> {
    const data = await cjClient.get<CJCategoryResponse[]>('/product/getCategory');
    const categories: CJCategory[] = [];

    for (const first of data) {
      for (const second of first.categoryFirstList || []) {
        for (const third of second.categorySecondList || []) {
          categories.push({
            categoryId: third.categoryId,
            categoryName: `${first.categoryFirstName} > ${second.categorySecondName} > ${third.categoryName}`,
          });
        }
      }
    }

    return categories;
  }

  normalizeProductForList(item: CJProductListItem) {
    return {
      id: item.id,
      name: item.nameEn,
      image: item.bigImage,
      price: parseFloat(item.sellPrice) || 0,
      currency: 'USD',
      categoryId: item.categoryId,
      categoryName: item.threeCategoryName,
      warehouse: '',
      shippingTime: item.deliveryCycle || '',
      stock: item.warehouseInventoryNum || 0,
    };
  }

  normalizeProductForDetail(
    detail: CJProductDetail,
    variants?: CJVariant[],
    stockMap?: Record<string, number>
  ) {
    const resolvedVariants =
      variants && variants.length ? variants : detail.variants || [];
    const resolvedStock =
      stockMap && Object.keys(stockMap).length ? stockMap : detail.variantStock || {};

    const variantData = resolvedVariants.map(v => ({
      vid: v.vid,
      sku: v.sku,
      name: v.attrs.map(a => `${a.attrName}: ${a.attrValue}`).join(' / '),
      price: v.price,
      stock: resolvedStock[v.vid] ?? v.stock ?? 0,
      attrs: v.attrs,
    }));

    return {
      id: detail.pid,
      name: detail.productName,
      description: detail.productDesc,
      image: detail.productImage,
      images: detail.productImages || [detail.productImage].filter(Boolean),
      price: detail.productPrice,
      currency: detail.currency,
      categoryId: detail.categoryId,
      categoryName: detail.categoryName,
      categoryPath: detail.categoryPath,
      warehouse: detail.warehouse,
      shippingTime: detail.shippingTime,
      stock: detail.availableStock,
      videoUrl: detail.videoUrl,
      attributes: detail.attrs || [],
      variants: variantData,
    };
  }

  /**
   * Maps the legacy productDetail/query payload onto the detail shape used
   * by the mapper. Variants (stanProducts) and per-variant stock
   * (variantInventory) travel with the same response, so an import needs one
   * CJ call per product instead of three.
   */
  private normalizeProductDetailResponse(
    raw: CJProductDetailRaw,
    fallbackPid: string
  ): CJProductDetail {
    const images = Array.isArray(raw.newImgList) && raw.newImgList.length
      ? raw.newImgList.filter(Boolean)
      : String(raw.img || '')
          .split(',')
          .map(part => part.trim())
          .filter(Boolean);

    const variants: CJVariant[] = (raw.stanProducts || []).map(sp =>
      this.normalizeVariantResponse({
        vid: sp.id,
        sku: sp.sku,
        price: sp.sellprice,
        variantKey: sp.variantkey ?? sp.variantKey,
      })
    );

    const variantStock: Record<string, number> = {};
    let stockKnown = false;
    for (const entry of raw.variantInventory || []) {
      if (!entry?.vid) continue;
      variantStock[entry.vid] = (entry.inventory || []).reduce(
        (sum, item) => sum + (Number(item?.totalInventory) || 0),
        0
      );
      stockKnown = true;
    }

    if (stockKnown) {
      for (const variant of variants) {
        variant.stock = variantStock[variant.vid] ?? variant.stock;
      }
    }

    const availableStock = Object.values(variantStock).reduce((sum, value) => sum + value, 0);
    const categoryName = raw.category || '';

    return {
      pid: String(raw.id || fallbackPid),
      productName: raw.nameen || raw.name || '',
      productDesc: raw.description || '',
      productImage: raw.bigimg || images[0] || '',
      productImages: images,
      productPrice: parseFloat(String(raw.sellprice)) || 0,
      currency: raw.currency || 'USD',
      categoryId: raw.categoryid || '',
      categoryName,
      categoryPath: categoryName,
      warehouse: '',
      shippingTime: '',
      availableStock,
      videoUrl: raw.thirdVideoList?.[0]?.url,
      attrs: [],
      variants,
      variantStock: stockKnown ? variantStock : null,
    };
  }

  /** Handles both the bare-array variant payload and a `{ list }` wrapper. */
  private normalizeVariantResponse(raw: CJVariantRaw): CJVariant {
    const variantKey = raw.variantKey || raw.variantkey || '';
    const stock = Number(raw.stock ?? raw.inventoryNum ?? 0) || 0;

    return {
      vid: String(raw.vid ?? raw.id ?? ''),
      sku: String(raw.sku ?? raw.variantSku ?? ''),
      price: parseFloat(String(raw.price ?? raw.variantSellPrice ?? raw.sellprice ?? 0)) || 0,
      stock,
      attrs:
        Array.isArray(raw.attrs) && raw.attrs.length
          ? raw.attrs
          : variantKey
            ? [{ attrId: 0, attrValueId: 0, attrName: 'Variant', attrValue: variantKey }]
            : [],
    };
  }
}

export default new CJProductsService();
