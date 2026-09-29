'use strict';

// Hard-copied Base assumptions. These values are intentionally local so Base
// calculations do not depend on a live market-data request.
// Rates are nominal long-term compound/gross/total-return CAGRs over the
// longest published history used for each benchmark; app.js converts them to
// real returns using the user's inflation input.
window.__marketData = Object.freeze({
  sp500: Object.freeze({
    id: 'sp500',
    monthlyLevels: null,
    label: 'S&P 500',
    nominalCagr: 0.1123,
    start: '1946-01',
    end: '2026-08',
    basis: '最長期間 Total Return CAGR',
    sourceLabel: 'Pinned S&P 500 total return history',
    sourceUrl: 'https://github.com/GaMa96/lfc-sp500-data',
    note: '1946年開始から2026年8月までの配当再投資込み長期年率'
  }),
  acwi: Object.freeze({
    id: 'acwi',
    monthlyLevels: null,
    label: 'MSCI ACWI',
    nominalCagr: 0.0882,
    start: '1987-12-31',
    end: '2026-04-30',
    basis: '最長期間 Gross Return CAGR',
    sourceLabel: 'MSCI ACWI Index factsheet (USD, Gross Returns)',
    sourceUrl: 'https://www.msci.com/documents/10199/255599/msci-acwi.pdf',
    note: '1987年末から2026年4月末までのUSDグロスリターン年率（MSCI公表8.82%）'
  }),
  nasdaq100: Object.freeze({
    id: 'nasdaq100',
    monthlyLevels: null,
    label: 'NASDAQ-100',
    nominalCagr: 0.1425,
    start: '1985-01-31',
    end: '2024-12-31',
    basis: '設定来 Compound Return CAGR',
    sourceLabel: 'Nasdaq: Nasdaq-100 Index Celebrates 40 Years of Innovation',
    sourceUrl: 'https://www.nasdaq.com/articles/nasdaq-100-indexr-celebrates-40-years-innovation',
    note: '1985年1月31日の設定来から2024年末までのNasdaq公表複利年率14.25%'
  })
});
