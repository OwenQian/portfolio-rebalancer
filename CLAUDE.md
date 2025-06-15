# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Portfolio Rebalancer is a React-based web and desktop application for investment portfolio management. It helps users track holdings across multiple accounts, compare against target allocations, and get specific rebalancing recommendations with buy/sell suggestions.

## Development Commands

```bash
npm start          # Development server (runs on port 3001)
npm run build      # Production build
npm test           # Run Jest tests
npm run electron   # Desktop app development mode
npm run package    # Build desktop distributables (macOS/Windows/Linux)
```

## Architecture

### Dual Platform Design
- **Web version**: Uses localStorage for persistence with manual backup/restore
- **Desktop version**: Electron app with automatic file-based backups and enhanced features

### Core Data Flow
1. State managed in `App.js` using React hooks with localStorage persistence
2. Desktop app uses file system storage via `fileStorage.js` utilities
3. Real-time price data fetched from Marketstack API
4. Portfolio calculations performed by algorithms in `portfolioUtils.js`

### Key Components
- **ModelPortfolioManager**: Target allocation management
- **CurrentPortfolio**: Multi-account holdings tracking  
- **PortfolioComparison**: Core rebalancing logic and recommendations
- **CategoryManager**: Asset categorization system

## Critical Files

### `/src/utils/portfolioUtils.js`
Contains the core rebalancing algorithms. Key functions:
- `calculateRebalancing()`: Main algorithm for buy/sell recommendations
- `calculateAllocation()`: Portfolio allocation analysis
- Handle edge cases like empty portfolios and missing price data

### `/src/utils/fileStorage.js`
Desktop-specific file operations for data persistence and backup management.

### `/src/App.js`
Central state management and data persistence logic. All portfolio data flows through this component.

## Data Structure

The application manages these core data types:
```javascript
modelPortfolios: [{ name, stocks: [{ symbol, percentage }] }]
accounts: [{ name, positions: [{ symbol, shares }] }]
stockPrices: { symbol: price }
categories: [{ id, name }]
stockCategories: { symbol: categoryId }
```

## Testing

Tests use Jest and React Testing Library. Critical test coverage includes:
- `PortfolioComparison.test.js`: Rebalancing algorithm validation
- `backup-restore.test.js`: Data persistence operations
- `export-import.test.js`: CSV/JSON data exchange

## Known Issues (from TODO.md)

1. **Buy-only rebalancing**: Overweight prevention logic needs refinement
2. **Sell-buy calculations**: Share calculation errors in sell order generation
3. **Date handling**: Timezone issues with portfolio value snapshots

## API Integration

Uses Marketstack API for real-time stock prices with rate limiting and batch processing. API key stored in localStorage/file system depending on platform.

## Styling

Uses React Bootstrap 2.10.9 with Bootstrap 5.3.3 for responsive design. Charts implemented with Chart.js via react-chartjs-2 integration.