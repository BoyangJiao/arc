/**
 * Asset detail chart module spacing — independent from Portfolio hero.
 *
 * Chart top edge = SLOT_HEIGHT + TIME_RANGE_TO_CHART_GAP below the change row.
 * That gap is always reserved so the scrub price chip never collides with the
 * date row and the plot never shifts when scrub starts.
 */

/** Period-change row → time-range (or scrub date) row. */
export const ASSET_DETAIL_CHANGE_TO_TIME_RANGE_GAP = 6;

/**
 * Time-range / scrub-date row → chart plot — permanent dead zone for crosshair chip.
 * Increase if date and chip still feel tight; decrease if idle gap looks too wide.
 */
export const ASSET_DETAIL_TIME_RANGE_TO_CHART_GAP = 14;

/** Fixed slot — segment sm row and one-line scrub date must fit here. */
export const ASSET_DETAIL_TIME_RANGE_SLOT_HEIGHT = 40;

/** Chart plot height (px). */
export const ASSET_DETAIL_CHART_HEIGHT = 208;
