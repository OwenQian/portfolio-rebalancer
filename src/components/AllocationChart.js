import React from 'react';
import { Card } from 'react-bootstrap';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { formatDollarAmount, formatNumber } from '../utils/formatters';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

const AllocationChart = ({ accounts, categories, stockCategories, stockPrices }) => {
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

    // Calculate values by category
    accounts.forEach(account => {
      account.positions.forEach(position => {
        const price = stockPrices[position.symbol] || 0;
        const value = price * position.shares;
        totalValue += value;

        const categoryId = stockCategories[position.symbol] || 'uncategorized';
        categoryAllocations[categoryId] = (categoryAllocations[categoryId] || 0) + value;
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
        labels: {
          boxWidth: 12
        }
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

  return (
    <Card className="h-100">
      <Card.Header>
        <h5 className="mb-0">Asset Allocation</h5>
      </Card.Header>
      <Card.Body>
        {totalValue > 0 ? (
          <div className="chart-container">
            <Pie data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="text-center p-4">
            <p>No portfolio data to display.</p>
            <p>Add positions to your accounts to see your asset allocation.</p>
          </div>
        )}
      </Card.Body>
      <Card.Footer className="text-muted">
        Total Portfolio Value: {formatDollarAmount(totalValue)}
      </Card.Footer>
    </Card>
  );
};

export default AllocationChart;
