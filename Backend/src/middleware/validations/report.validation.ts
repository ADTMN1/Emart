import { query } from 'express-validator';
import { validate } from '../validator';

/**
 * Sales report validation (Phase 4).
 *
 * Period presets resolve server-side to exact UTC boundaries; custom ranges
 * accept YYYY-MM-DD strings (inclusive both ends) and are bounded to a
 * maximum of 366 days so trend bucket counts stay finite.
 */

export const REPORT_PERIODS = ['today', 'last7', 'last30', 'thisMonth', 'lastMonth', 'custom'] as const;

const MAX_RANGE_DAYS = 366;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const periodRule = query('period')
  .optional()
  .isIn(REPORT_PERIODS as unknown as string[])
  .withMessage(`Invalid period. Must be one of: ${REPORT_PERIODS.join(', ')}.`);

const dateRules = [
  query('from')
    .optional()
    .matches(DATE_RE)
    .withMessage('from must be a date in YYYY-MM-DD format.')
    .bail()
    .isISO8601({ strict: true })
    .withMessage('from must be a valid calendar date.'),
  query('to')
    .optional()
    .matches(DATE_RE)
    .withMessage('to must be a date in YYYY-MM-DD format.')
    .bail()
    .isISO8601({ strict: true })
    .withMessage('to must be a valid calendar date.'),
];

/** Shared range sanity checks that need both values. */
const rangeConsistencyRule = query('rangeCheck').custom((_value, { req }) => {
  const period = req.query?.period || 'today';
  const { from, to } = req.query as { from?: string; to?: string };

  if (period === 'custom') {
    if (!from || !to) {
      throw new Error('Custom period requires both from and to dates (YYYY-MM-DD).');
    }
    const start = new Date(`${from}T00:00:00.000Z`);
    const endExclusive = new Date(`${to}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
      throw new Error('from/to must be valid calendar dates.');
    }
    if (endExclusive <= start) {
      throw new Error('The end date must be on or after the start date.');
    }
    const dayCount = Math.round((endExclusive.getTime() - start.getTime()) / 86400000);
    if (dayCount > MAX_RANGE_DAYS) {
      throw new Error(`Date range is limited to ${MAX_RANGE_DAYS} days.`);
    }
  } else if (from || to) {
    throw new Error('from/to are only valid when period=custom.');
  }
  return true;
});

/** Shared pagination rules for top-products / category tables. */
export const reportPaginationRules = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('page must be a positive integer.')
    .bail()
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be an integer between 1 and 100.')
    .bail()
    .toInt(),
];

export const salesOverviewValidation = [periodRule, ...dateRules, rangeConsistencyRule, validate];
export const salesTrendValidation = [periodRule, ...dateRules, rangeConsistencyRule, validate];
export const salesProductsValidation = [periodRule, ...dateRules, rangeConsistencyRule, ...reportPaginationRules, validate];
export const salesCategoriesValidation = [periodRule, ...dateRules, rangeConsistencyRule, ...reportPaginationRules, validate];
