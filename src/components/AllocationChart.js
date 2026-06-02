import React from 'react';
import { Card } from 'react-bootstrap';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { formatDollarAmount, formatNumber } from '../utils/formatters';
import { distributeToCategoriesByValue } from '../utils/categoryUtils';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

const AllocationChart = ({ accounts, categories, stockCategories, stockPrices, showHeader = true }) => {
  // Generate random colors for categories
  const generateColors = (count) => {
    const colors = [];
    for (let i = 0; i < count; i++) {
      const hue = (i * 137) % 360; // Use golden angle approximation for good distribution
      colors.push(`hsl(${hue}, 70%, 60%)`);
    }
    return colors;
  };

  // Calculate allocation by category
  const calculateAllocationByCategory = () => {
    const categoryAllocations = {};
    let totalValue = 0;

    // Initialize categories
    categories.forEach(category => {
      categoryAllocations[category.id] = 0;
    });

    // Add an "Uncategorized" category
    categoryAllocations['uncategorized'] = 0;

    // Calculate values by category — distribute across multi-category splits
    accounts.forEach(account => {
      account.positions.forEach(position => {
        const price = stockPrices[position.symbol] || 0;
        const value = price * position.shares;
        totalValue += value;

        const distributed = distributeToCategoriesByValue(stockCategories, position.symbol, value);
        for (const [catId, amt] of Object.entries(distributed)) {
          categoryAllocations[catId] = (categoryAllocations[catId] || 0) + amt;
        }
      });
    });

    // Convert to percentages
    if (totalValue > 0) {
      Object.keys(categoryAllocations).forEach(categoryId => {
        categoryAllocations[categoryId] = (categoryAllocations[categoryId] / totalValue) * 100;
      });
    }

    return { categoryAllocations, totalValue };
  };

  const { categoryAllocations, totalValue } = calculateAllocationByCategory();

  // Prepare data for the pie chart
  const chartData = {
    labels: categories.map(cat => cat.name).concat(['Uncategorized']),
    datasets: [
      {
        data: categories.map(cat => categoryAllocations[cat.id] || 0).concat([categoryAllocations['uncategorized'] || 0]),
        backgroundColor: generateColors(categories.length + 1),
        borderWidth: 1,
      },
    ],
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        align: 'center',
        labels: {
          boxWidth: 12,
          font: {
            size: 11
          },
          padding: 8
        },
        display: true,
        maxWidth: 120
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.raw.toFixed(2) || 0;
            return `${label}: ${formatNumber(value)}%`;
          }
        }
      }
    }
  };

  const renderChart = () => (
    totalValue > 0 ? (
      <div className="chart-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Pie data={chartData} options={chartOptions} />
      </div>
    ) : (
      <div className="text-center p-4">
        <p>No portfolio data to display.</p>
        <p>Add positions to your accounts to see your asset allocation.</p>
      </div>
    )
  );

  if (!showHeader) {
    return renderChart();
  }

  return (
    <Card className="h-100">
      <Card.Header>
        <h5 className="mb-0">Asset Allocation</h5>
      </Card.Header>
      <Card.Body>
        {renderChart()}
      </Card.Body>
      <Card.Footer className="text-muted">
        Total Portfolio Value: {formatDollarAmount(totalValue)}
      </Card.Footer>
    </Card>
  );
};

export default AllocationChart;
