import {
  buildPriceSyncErrorMessage,
  extractMarketstackPrices,
  getMarketstackPreflightIssue,
  MARKETSTACK_EOD_LATEST_URL,
  partitionSymbolsForMarketstack,
} from '../utils/priceSyncUtils';

describe('priceSyncUtils', () => {
  it('uses Marketstack V2 for latest EOD prices', () => {
    expect(MARKETSTACK_EOD_LATEST_URL).toBe('https://api.marketstack.com/v2/eod/latest');
  });

  describe('getMarketstackPreflightIssue', () => {
    it('flags Yahoo-style crypto symbols before requesting Marketstack', () => {
      expect(getMarketstackPreflightIssue('BTC-USD')).toContain('Yahoo-style crypto pair');
      expect(getMarketstackPreflightIssue('ETH-USD')).toContain('Yahoo-style crypto pair');
    });

    it('allows ordinary stock and ETF tickers', () => {
      expect(getMarketstackPreflightIssue('AAPL')).toBeNull();
      expect(getMarketstackPreflightIssue('VTI')).toBeNull();
      expect(getMarketstackPreflightIssue('BRK.B')).toBeNull();
    });

    it('flags blank and malformed symbols', () => {
      expect(getMarketstackPreflightIssue('')).toBe('Blank symbol');
      expect(getMarketstackPreflightIssue('ABC/DEF')).toContain('outside A-Z');
    });
  });

  describe('partitionSymbolsForMarketstack', () => {
    it('deduplicates and separates requestable symbols from skipped symbols', () => {
      const result = partitionSymbolsForMarketstack(['aapl', 'AAPL', 'BTC-USD', 'VTI']);

      expect(result.requestableSymbols).toEqual(['AAPL', 'VTI']);
      expect(result.skippedSymbols).toEqual([
        {
          symbol: 'BTC-USD',
          reason: 'Yahoo-style crypto pair; Marketstack EOD does not support crypto pair symbols like BTC-USD',
        },
      ]);
    });
  });

  describe('extractMarketstackPrices', () => {
    it('extracts valid close prices and reports missing requested symbols', () => {
      const result = extractMarketstackPrices(['AAPL', 'MSFT'], {
        data: [
          { symbol: 'AAPL', close: 306.31 },
        ],
      });

      expect(result.prices).toEqual({ AAPL: '306.31' });
      expect(result.failures).toEqual([
        { symbol: 'MSFT', reason: 'No data row returned by Marketstack' },
      ]);
    });

    it('reports rows without positive close prices', () => {
      const result = extractMarketstackPrices(['AAPL'], {
        data: [
          { symbol: 'AAPL', close: null },
        ],
      });

      expect(result.prices).toEqual({});
      expect(result.failures).toEqual([
        { symbol: 'AAPL', reason: 'Response row did not include a positive close price' },
      ]);
    });

    it('reports malformed responses for each requested symbol', () => {
      const result = extractMarketstackPrices(['AAPL', 'VTI'], {});

      expect(result.prices).toEqual({});
      expect(result.failures).toEqual([
        { symbol: 'AAPL', reason: 'Response did not include a data array' },
        { symbol: 'VTI', reason: 'Response did not include a data array' },
      ]);
    });
  });

  describe('buildPriceSyncErrorMessage', () => {
    it('builds a readable multiline diagnostic', () => {
      const message = buildPriceSyncErrorMessage({
        successCount: 1,
        successfulSymbols: ['AAPL'],
        failedSymbols: [{ symbol: 'MSFT', reason: 'No data row returned by Marketstack' }],
        skippedSymbols: [{ symbol: 'BTC-USD', reason: 'Yahoo-style crypto pair' }],
        batchErrors: [{ symbols: ['AAPL', 'MSFT'], reason: 'HTTP 422: invalid symbol' }],
        stoppedEarly: true,
      });

      expect(message).toContain('Price sync updated 1 symbol.');
      expect(message).toContain('Updated successfully (1):');
      expect(message).toContain('- AAPL');
      expect(message).toContain('Stopped after the first API failure');
      expect(message).toContain('MSFT: No data row returned by Marketstack');
      expect(message).toContain('BTC-USD: Yahoo-style crypto pair');
      expect(message).toContain('AAPL, MSFT: HTTP 422: invalid symbol');
    });
  });
});
