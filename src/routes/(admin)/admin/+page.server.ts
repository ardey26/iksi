import type { PageServerLoad } from './$types';
import {
  getKPIs, getTimeSeries, getTopLinks,
  getCountryBreakdown, getReferrerBreakdown, getUABreakdown
} from '$lib/server/stats';
import { decodeURL } from '$lib/server/crypto.js';

export const load: PageServerLoad = async ({ url }) => {
  const rawRange = Number(url.searchParams.get('range'));
  const days: 7 | 30 | 90 = rawRange === 7 || rawRange === 90 ? rawRange : 30;
  const includeBots = url.searchParams.get('bots') === '1';
  const sort: 'clicks' | 'created' = url.searchParams.get('sort') === 'created' ? 'created' : 'clicks';

  // KPI row is awaited (fast). Everything else streams.
  const kpis = await getKPIs();

  return {
    days,
    includeBots,
    sort,
    kpis,
    streamed: {
      timeSeries: getTimeSeries({ days, includeBots }),
      topLinks: getTopLinks({ sort }).then(async (rows) =>
        Promise.all(rows.map(async (r) => ({ ...r, originalURL: await decodeURL(r.originalURL) })))
      ),
      countries: getCountryBreakdown({ includeBots }),
      referrers: getReferrerBreakdown({ includeBots }),
      ua: getUABreakdown({ includeBots })
    }
  };
};
