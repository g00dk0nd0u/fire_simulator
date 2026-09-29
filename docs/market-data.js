'use strict';

// Market assumptions and histories are local to the repository at runtime.
// S&P 500 Base/Recent/Conservative use the pinned local monthly Total Return
// series; ACWI and NASDAQ-100 currently use published since-inception CAGRs
// for Base only because redistributable monthly histories are not bundled.
window.__marketData = Object.freeze({
  sp500: Object.freeze({
    id: 'sp500',
    baseRateSource: 'monthly_history',
    monthlyLevels: window.__lfcSpData || null,
    historyStart: '1946-01',
    label: 'S&P 500',
    symbol: 'nomTRP',
    currency: 'USD',
    returnType: 'Total Return',
    nominalCagr: 0.1123,
    start: '1946-01',
    end: '2026-08',
    basis: '最長期間 Total Return CAGR',
    sourceLabel: 'Pinned local S&P 500 total return history',
    sourceUrl: 'https://github.com/GaMa96/lfc-sp500-data/tree/ac66267d99aaa0f88c41f93acabc639a9a4dd908',
    note: '固定commit由来の月次Total Return系列をローカル固定し、1946年1月以降を使用'
  }),
  acwi: Object.freeze({
    id: 'acwi',
    baseRateSource: 'published_cagr',
    monthlyLevels: null,
    historyStart: '1987-12',
    label: 'MSCI ACWI',
    symbol: '892400',
    currency: 'USD',
    returnType: 'Gross Return',
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
    baseRateSource: 'published_cagr',
    monthlyLevels: null,
    historyStart: '1985-01',
    label: 'NASDAQ-100',
    symbol: 'XNDX',
    currency: 'USD',
    returnType: 'Total Return',
    nominalCagr: 0.1425,
    start: '1985-01-31',
    end: '2024-12-31',
    basis: '設定来 Compound Return CAGR',
    sourceLabel: 'Nasdaq: Nasdaq-100 Index Celebrates 40 Years of Innovation',
    sourceUrl: 'https://www.nasdaq.com/articles/nasdaq-100-indexr-celebrates-40-years-innovation',
    note: '1985年1月31日の設定来から2024年末までのNasdaq公表複利年率14.25%'
  })
});
