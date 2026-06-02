03/20/2025 - 3:31 AM
* I have a bug with the snapshot save and restore, it's losing the snapshot data for portfolio history
* when I edit a position to an earlier year, and also when I change the amount, then back up and restore, the changes are lost
* also change the backup system to write to a backups folder since backuping by timestamp every time is going to create many files.
* I think the only the manual backup is creating new files, the auto save is saving to portfolioData.json
* there's probably some issue with timezones too, since I'm using dec 31, the year can roll over
* fixing this backup and restore, and testing it
* the test should take a sequence of actions and validate that the backup generated has the expected content
03/24/2025 - 3:40 AM
* the back up and restore bug seems fixed
* I noticed the buy only rebalancing has strange behavior; when selecting a single stock if the buy amount ends up overweighting the category, then it only invests a portion of the funds, but still reaches a surplus, you have to make multiple iterations, reducing the invested amount to figure out the max amount to invest that's still under the target threshhold. It should do this in one shot instead of requiring iteration. I think the bug is because it's only investing some percentage, but the unutilized funds are still being included somehow
* I also want to add a feature where in buy-only rebalancing it calculates how much I need to buy to balance things out using the selected positions
* there's also a bug in the sell-buy rebalancing where it tells me to sell more shares than I have, e.g. SPY it wants me to sell 179 shares even though I only have 5 shares in Manulife
* the amount total in sell-buy rebalancing also doesn't make sense since it should net out to 0

06/02/2026 - codebase bug/inefficiency review

High severity (correctness / data loss):
* [ ] Direct state mutation of position/stock objects — shallow array copy then mutate inner object. CurrentPortfolio.js handleSavePosition (~392-394) & handleUpdateShares (~442-443); ModelPortfolioManager.js percentage onChange (~569-572) & handleStockCategoryChange (~134-138). Fix: replace object with a spread copy.
* [ ] MultiCategorySelector can persist allocations not summing to 100% — onChange fires with any running total; isValid is cosmetic (~40, 101-102, 195-197). Gate persistence on validateCategoryAllocations + clamp rows to [0,100].
* [ ] Sell-buy over-sells multi-category stocks & suggests un-executable share counts — uses full positionToSell.value not categoryValue; same item shared across categories; shares not bounded by named account. PortfolioComparison.js (~357-413).
* [ ] App white-screens on corrupt localStorage — unguarded JSON.parse in every useState initializer. App.js (~39-95). Wrap in try/catch + fallback.
* [ ] Auto-save races async file restore; can restore over intentional deletions. App.js (~262-297, 326-373). Add a "hydrated" flag.

Medium severity:
* [ ] Unguarded localStorage setItem + unbounded portfolioValueHistory -> QuotaExceeded crash. App.js (~300-323, 966-981). try/catch + prune history.
* [ ] What-If projected total shows NaN for categories with no holdings. PortfolioComparison.js (~2196-2201). Use (currentAllocation[cat] || 0).
* [ ] Snapshot edit/delete targets wrong record (timestamp+value match, no stable id). CurrentPortfolio.js (~587-596, 681-690). Add unique id per snapshot.
* [ ] Snapshot values stored as strings (calculateTotalPortfolioValue returns toFixed string). App.js (~977, 993). Store as Number.
* [ ] Expanded-accounts collapses on every account add/remove + initial all-expanded flash. CurrentPortfolio.js (~42, 52-55).
* [ ] Array index used as React key in lists that splice/sort/reorder. CurrentPortfolio.js (~1059, 1341); ModelPortfolioManager.js (~297, 331, 437, 562). Use stable keys.
* [ ] Background price sync wipes unsaved in-progress edits (tempPrices/tempCategories). CurrentPortfolio.js (~58-61). Guard with !editingAssets.
* [ ] Model portfolio edit modal saves NaN percentage (Math.abs(NaN-100)>0.01 is false). ModelPortfolioManager.js (~571, 222-226).
* [ ] Aggregated allocation chart: bonds never reach the "Bonds" group; name-based grouping fragile. AggregatedAllocationChart.js (~75-85).
* [ ] PortfolioValueChart: divide-by-zero renders Infinity/NaN; setMonth month-overflow cutoffs; empty filtered range -> Invalid Date. (~42-57, 66-72, 241-247).
* [ ] Floating-point money math via toFixed string round-tripping. CurrentPortfolio.js (~469-486); Math.floor(value/price) without epsilon in PortfolioComparison.js.

Low / robustness / performance:
* [ ] fileStorage: new Promise(async) anti-pattern (~77, 129); ENOENT retried as cloud error (~469-480); path.join(null) crash in importDataBackup (~270-271).
* [ ] handlePasteJson manipulates DOM directly in React modal + status text never set (textContent = setRestoreStatus()). App.js (~649-704).
* [ ] Performance: chart data & portfolio helpers (getStocksInUse in a .map, chartData/chartOptions literals) recomputed every render; wrap in useMemo. AggregatedAllocationChart.js, AllocationChart.js, CurrentPortfolio.js (~907), PortfolioComparison.js.
* [ ] generateRebalanceSuggestions: overweight sells one stock the full deviation; underweight model-stock fallback can double-buy. portfolioUtils.js (~164-225).