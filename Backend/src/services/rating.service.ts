import prisma from '../config/database';
import { BadRequestError, NotFoundError } from '../utils/errors';

const MIN_RATING = 1;
const MAX_RATING = 5;

/**
 * User product ratings.
 *
 * Aggregates are denormalized onto products (ratingAgg / ratingCount) inside a
 * transaction on every write so product lists never need a join/aggregate
 * query to render real averages. No default/seeded ratings are ever created —
 * products start at 0.0 with 0 ratings until real users rate them.
 */
export class RatingService {
  // Injectable client so unit tests can pass a fake Prisma (see
  // rating.service.test.ts); production uses the real singleton.
  private prisma: typeof prisma;

  constructor(prismaClient: typeof prisma = prisma) {
    this.prisma = prismaClient;
  }

  /**
   * Create or update the authenticated user's rating for a product.
   * The (userId, productId) unique constraint guarantees one rating per user
   * per product; re-rating updates the existing row.
   */
  async rateProduct(userId: string, productId: string, rating: number): Promise<{
    id: string;
    productId: string;
    rating: number;
    average: number;
    count: number;
    isNew: boolean;
  }> {
    const value = Number(rating);
    if (!Number.isInteger(value) || value < MIN_RATING || value > MAX_RATING) {
      throw new BadRequestError(`Rating must be an integer between ${MIN_RATING} and ${MAX_RATING}`);
    }

    const productExists = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!productExists) {
      throw new NotFoundError('Product not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert: change an existing rating rather than creating a duplicate.
      const existing = await tx.productRating.findUnique({
        where: { userId_productId: { userId, productId } },
        select: { id: true, rating: true },
      });

      const isNew = !existing;
      const saved = existing
        ? await tx.productRating.update({
            where: { id: existing.id },
            data: { rating: value },
            select: { id: true, rating: true },
          })
        : await tx.productRating.create({
            data: { userId, productId, rating: value },
            select: { id: true, rating: true },
          });

      const agg = await tx.productRating.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      const average = agg._avg.rating ?? 0;
      const count = agg._count.rating ?? 0;

      await tx.product.update({
        where: { id: productId },
        data: {
          ratingAgg: Math.round(average * 100) / 100,
          ratingCount: count,
        },
        select: { id: true },
      });

      return { saved, isNew, average, count };
    });

    return {
      id: result.saved.id,
      productId,
      rating: result.saved.rating,
      average: result.average,
      count: result.count,
      isNew: result.isNew,
    };
  }

  /** All of a user's product ratings, keyed for O(1) lookup by productId. */
  async getUserRatingMap(userId: string): Promise<Record<string, number>> {
    const ratings = await this.prisma.productRating.findMany({
      where: { userId },
      select: { productId: true, rating: true },
    });

    const map: Record<string, number> = {};
    for (const r of ratings) {
      map[r.productId] = r.rating;
    }
    return map;
  }

  /** The signed-in user's rating for one product (null when unrated). */
  async getUserRatingForProduct(userId: string, productId: string): Promise<number | null> {
    const rating = await this.prisma.productRating.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { rating: true },
    });
    return rating?.rating ?? null;
  }
}

export default new RatingService();
