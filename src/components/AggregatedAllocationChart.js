import React from 'react';
import { Card } from 'react-bootstrap';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { formatDollarAmount, formatNumber } from '../utils/formatters';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

const AggregatedAllocationChart = ({ accounts, categories, stockCategories, stockPrices, showHeader = true }) => {
  // Generate colors for the grouped categories
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

    return { categoryAllocations, totalValue };
  };

  const { categoryAllocations, totalValue } = calculateAllocationByCategory();

  // Group the categories as requested
  const groupCategories = () => {
    // Create a mapping of category IDs to their names
    const categoryIdToName = {};
    categories.forEach(cat => {
      categoryIdToName[cat.id] = cat.name;
    });

    // Initialize grouped allocations
    const groupedAllocations = {
      'US': 0,
      'Developed': 0,
      'Emerging': 0,
      'Bonds': 0,
      'Other': 0
    };

    // Categorize each allocation into its group
    Object.entries(categoryAllocations).forEach(([categoryId, allocation]) => {
      const categoryName = categoryIdToName[categoryId] || 'Uncategorized';
      
      if (categoryName === 'US Large Cap' || categoryName === 'US Small Cap') {
        groupedAllocations['US'] += allocation;
      } else if (categoryName === 'International Developed Markets' || categoryName === 'International Small Cap') {
        groupedAllocations['Developed'] += allocation;
      } else if (categoryName === 'Emerging Markets' || categoryName === 'Emerging Small Cap') {
        groupedAllocations['Emerging'] += allocation;
      } else if (categoryName === 'Bonds') {
        groupedAllocations['Bonds'] += allocation;
      } else {
        groupedAllocations['Other'] += allocation;
      }
    });

    // Convert to percentages
    if (totalValue > 0) {
      Object.keys(groupedAllocations).forEach(group => {
        groupedAllocations[group] = (groupedAllocations[group] / totalValue) * 100;
      });
    }

    return groupedAllocations;
  };

  const groupedAllocations = groupCategories();

  // Order the groups logically
  const orderedGroups = ['US', 'Developed', 'Emerging', 'Bonds', 'Other'];
  
  // Define a distinct color palette for the grouped chart with higher contrast
  const groupColors = {
    'US': '#2E5EAA',         // Deep blue
    'Developed': '#33A02C',  // Green
    'Emerging': '#E31A1C',   // Red
    'Bonds': '#FF8C00',      // Orange
    'Other': '#6A3D9A'       // Purple
  };

  // Use the custom color palette
  const groupColorArray = orderedGroups.map(group => groupColors[group]);
  
  // Prepare data for the pie chart
  const chartData = {
    labels: orderedGroups,
    datasets: [
      {
        data: orderedGroups.map(group => groupedAllocations[group] || 0),
        backgroundColor: groupColorArray,
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
        <h5 className="mb-0">Grouped Asset Allocation</h5>
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

export default AggregatedAllocationChart; 