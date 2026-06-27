// WC26 EDGE · data layer (serialized from the canonical single-file app so the
// React build never drifts from the deployed data). Regenerate with the
// Playwright extractor if the source data changes.
import data from './data.json';

export const DATES    = data.DATES;
export const DAYS     = data.DAYS;
export const WC_TABLE = data.WC_TABLE;
export const OG_STATS = data.OG_STATS;
export const FIXTURES = data.FIXTURES;
export const MONTHS   = data.MONTHS;
export const UPDATED  = data.updated || null;
export const SOURCE   = data.source || 'openfootball (CC0 · free)';
export const LIVE     = data.LIVE || {};
export const CRICKET  = data.CRICKET || { blocks: [], source: 'seed (curated)' };
export default data;
