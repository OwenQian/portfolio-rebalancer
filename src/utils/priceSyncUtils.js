export function normalizeSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase();
}

export function getMarketstackPreflightIssue(symbol) {
  const normalized = normalizeSymbol(symbol);

  if (!normalized) {
    return 'Blank symbol';
  }

  if (/^[A-Z]+-USD$/.test(normalized)) {
    return 'Yahoo-style crypto pair; Marketstack EOD does not support crypto pair symbols like BTC-USD';
  }

  if (normalized.includes('-')) {
    return 'Contains a dash; Marketstack EOD symbols usually use exchange tickers without Yahoo-style suffixes';
  }

  if (!/^[A-Z0-9.]+$/.test(normalized)) {
    return 'Contains characters outside A-Z, 0-9, or dot';
  }

  return null;
}

export function partitionSymbolsForMarketstack(symbols) {
  const seen = new Set();
  const requestableSymbols = [];
  const skippedSymbols = [];

  symbols.forEach(symbol => {
    const normalized = normalizeSymbol(symbol);
    if (seen.has(normalized)) return;
    seen.add(normalized);

    const issue = getMarketstackPreflightIssue(normalized);
    if (issue) {
      skippedSymbols.push({ symbol: normalized || String(symbol), reason: issue });
    } else {
      requestableSymbols.push(normalized);
    }
  });

  return { requestableSymbols, skippedSymbols };
}

export async function parseMarketstackResponseError(response) {
  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    return `HTTP ${response.status} ${response.statusText || ''}`.trim();
  }

  const apiError = payload?.error;
  if (apiError?.message) {
    const code = apiError.code ? ` (${apiError.code})` : '';
    return `HTTP ${response.status}: ${apiError.message}${code}`;
  }

  return `HTTP ${response.status} ${response.statusText || ''}`.trim();
}

export function extractMarketstackPrices(symbols, payload) {
  const requestedSymbols = symbols.map(normalizeSymbol);
  const returnedSymbols = new Set();
  const prices = {};
  const failures = [];

  if (!payload || !Array.isArray(payload.data)) {
    return {
      prices,
      failures: requestedSymbols.map(symbol => ({
        symbol,
        reason: 'Response did not include a data array',
      })),
    };
  }

  payload.data.forEach(row => {
    const symbol = normalizeSymbol(row?.symbol);
    if (!symbol) {
      failures.push({ symbol: 'Unknown', reason: 'Response row did not include a symbol' });
      return;
    }

    returnedSymbols.add(symbol);
    const close = Number(row?.close);

    if (Number.isFinite(close) && close > 0) {
      prices[symbol] = close.toFixed(2);
      return;
    }

    failures.push({
      symbol,
      reason: 'Response row did not include a positive close price',
    });
  });

  requestedSymbols.forEach(symbol => {
    if (!returnedSymbols.has(symbol)) {
      failures.push({
        symbol,
        reason: 'No data row returned by Marketstack',
      });
    }
  });

  return { prices, failures };
}

export function buildPriceSyncErrorMessage({ successCount, failedSymbols, skippedSymbols, batchErrors }) {
  const lines = [
    `Price sync updated ${successCount} symbol${successCount === 1 ? '' : 's'}.`,
  ];

  if (failedSymbols.length > 0) {
    lines.push('');
    lines.push(`Failed after API request (${failedSymbols.length}):`);
    failedSymbols.forEach(({ symbol, reason }) => {
      lines.push(`- ${symbol}: ${reason}`);
    });
  }

  if (skippedSymbols.length > 0) {
    lines.push('');
    lines.push(`Skipped before API request (${skippedSymbols.length}):`);
    skippedSymbols.forEach(({ symbol, reason }) => {
      lines.push(`- ${symbol}: ${reason}`);
    });
  }

  if (batchErrors.length > 0) {
    lines.push('');
    lines.push('Batch errors:');
    batchErrors.forEach(({ symbols, reason }) => {
      lines.push(`- ${symbols.join(', ')}: ${reason}`);
    });
  }

  return lines.join('\n');
}
