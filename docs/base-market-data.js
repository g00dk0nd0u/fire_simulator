'use strict';

// Hard-copied Base assumptions. These values are intentionally local so Base
// calculations do not depend on a live market-data request.
// Rates are nominal annualized total-return CAGRs over the longest published
// history used for each benchmark; app.js converts them to real returns using
// the user's inflation input.
window.__baseMarketData = Object.freeze({
  sp500: Object.freeze({
    id: 'sp500',
    label: 'S&P 500',
    nominalCagr: 0.1123,
    start: '1946-01',
    end: '2026',
    basis: '最長期間 Total Return CAGR',
    sourceLabel: 'S&P 500 total return history',
    sourceUrl: 'https://www.officialdata.org/us/stocks/s-p-500/1946',
    note: '1946年開始から2026年までの配当再投資込み年率'
  }),
  acwi: Object.freeze({
    id: 'acwi',
    label: 'MSCI ACWI',
    nominalCagr: 0.0889,
    start: '1987-12-31',
    end: '2026-07-31',
    basis: '最長期間 Gross Return CAGR',
    sourceLabel: 'MSCI ACWI Index factsheet (USD, Gross Returns)',
    sourceUrl: 'https://www.msci.com/documents/10199/255599/msci-acwi.pdf',
    note: '1987年末から2026年7月末までのUSDグロスリターン年率'
  })
});
