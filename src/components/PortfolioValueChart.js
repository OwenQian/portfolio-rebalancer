import React, { useState } from 'react';
import { Card, Form, Button, Collapse, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip as ChartTooltip, Legend, TimeScale } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { formatDollarAmount } from '../utils/formatters';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, ChartTooltip, Legend, TimeScale);

const PortfolioValueChart = ({ portfolioValueHistory }) => {
  const [timeRange, setTimeRange] = useState('all'); // 'all', '1m', '3m', '6m', '1y'
  const [isExpanded, setIsExpanded] = useState(true); // Default to expanded
  const [showChangeMetrics, setShowChangeMetrics] = useState(true); // Default to showing change metrics
  
  // Ensure portfolioValueHistory is an array
  const safeHistory = Array.isArray(portfolioValueHistory) ? portfolioValueHistory : [];
  
  if (!safeHistory.length) {
    return (
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Portfolio Value History</h5>
        </Card.Header>
        <Card.Body className="text-center p-4">
          <p>No portfolio value history available yet.</p>
          <p className="text-muted small">History will be recorded each time you sync prices.</p>
        </Card.Body>
      </Card>
    );
  }

  // Sort history by date
  const sortedHistory = [...safeHistory].sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );

  // Filter data based on selected time range
  const filteredData = (() => {
    if (timeRange === 'all') return sortedHistory;
    
    const now = new Date();
    let cutoffDate;
    
    switch(timeRange) {
      case '1m':
        cutoffDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case '3m':
        cutoffDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case '6m':
        cutoffDate = new Date(now.setMonth(now.getMonth() - 6));
        break;
      case '1y':
        cutoffDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        return sortedHistory;
    }
    
    return sortedHistory.filter(item => new Date(item.date) >= cutoffDate);
  })();

  // Calculate change metrics
  const calculateMetrics = () => {
    if (filteredData.length < 2) return { change: 0, percentChange: 0 };
    
    const firstValue = parseFloat(filteredData[0].value);
    const lastValue = parseFloat(filteredData[filteredData.length - 1].value);
    const change = lastValue - firstValue;
    const percentChange = (change / firstValue) * 100;
    
    return { 
      change: change.toFixed(2), 
      percentChange: percentChange.toFixed(2) 
    };
  };

  const metrics = calculateMetrics();

  // Prepare data for Chart.js
  const chartData = {
    labels: filteredData.map(item => new Date(item.date)),
    datasets: [
      {
        label: 'Portfolio Value',
        data: filteredData.map(item => parseFloat(item.value)),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.1,
        pointRadius: 4,
        pointHoverRadius: 8,
        pointStyle: 'circle',
        pointBackgroundColor: 'rgba(75, 192, 192, 0.8)',
      }
    ]
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `Value: ${formatDollarAmount(context.raw)}`;
          },
          title: function(tooltipItems) {
            const date = new Date(tooltipItems[0].parsed.x);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: filteredData.length > 30 ? 'month' : 'day',
          tooltipFormat: 'PPP pp', // Format for the tooltip
          displayFormats: {
            day: 'MMM d',
            month: 'MMM yyyy'
          }
        },
        title: {
          display: true,
          text: 'Date'
        }
      },
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: 'Portfolio Value ($)'
        },
        ticks: {
          callback: function(value) {
            return formatDollarAmount(value);
          }
        }
      }
    }
  };

  // Get the latest portfolio value and its change
  const latestValue = filteredData.length ? parseFloat(filteredData[filteredData.length - 1].value) : 0;
  const latestChange = parseFloat(metrics.change);
  const latestPercentChange = parseFloat(metrics.percentChange);
  
  // Determine the color based on change direction
  const changeColor = latestChange >= 0 ? 'text-success' : 'text-danger';
  const changePrefix = latestChange >= 0 ? '+' : '';

  return (
    <Card className="mb-4">
      <Card.Header 
        className="d-flex justify-content-between align-items-center" 
        style={{ cursor: 'pointer' }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="d-flex align-items-center">
          <h5 className="mb-0 me-3">Portfolio Value History</h5>
          <Button 
            variant="outline-secondary" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation(); // Prevent Card.Header click from triggering
              setIsExpanded(!isExpanded);
            }}
            className="me-2"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </Button>
          
          <OverlayTrigger
            placement="top"
            overlay={<Tooltip id="change-metrics-tooltip">
              {showChangeMetrics ? 'Hide change metrics' : 'Show change metrics'}
            </Tooltip>}
          >
            <Button 
              variant={showChangeMetrics ? "outline-secondary" : "outline-primary"}
              size="sm" 
              onClick={(e) => {
                e.stopPropagation(); // Prevent Card.Header click from triggering
                setShowChangeMetrics(!showChangeMetrics);
              }}
              className="me-2"
            >
              <i className={`bi ${showChangeMetrics ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              {' '}
              {showChangeMetrics ? 'Hide Changes' : 'Show Changes'}
            </Button>
          </OverlayTrigger>
          
          {/* Show a summary of current value and change when collapsed */}
          {!isExpanded && (
            <div className="ms-3">
              <span>{formatDollarAmount(latestValue)}</span>
              {showChangeMetrics && (
                <span className={`ms-2 ${changeColor}`}>
                  {changePrefix}{formatDollarAmount(latestChange)} ({changePrefix}{latestPercentChange}%)
                </span>
              )}
            </div>
          )}
        </div>
        
        {isExpanded && (
          <Form.Select
            size="sm"
            className="w-auto"
            value={timeRange}
            onChange={(e) => {
              e.stopPropagation(); // Prevent Card.Header click from triggering
              setTimeRange(e.target.value);
            }}
          >
            <option value="all">All Time</option>
            <option value="1y">Last Year</option>
            <option value="6m">Last 6 Months</option>
            <option value="3m">Last 3 Months</option>
            <option value="1m">Last Month</option>
          </Form.Select>
        )}
      </Card.Header>
      
      <Collapse in={isExpanded}>
        <div>
          <Card.Body>
            <div className="d-flex justify-content-between mb-3">
              <div>
                <strong>First:</strong> {formatDollarAmount(filteredData[0]?.value || 0)}
                <div className="text-muted small">
                  {new Date(filteredData[0]?.date).toLocaleDateString()}
                </div>
              </div>
              <div className="text-end">
                <strong>Current:</strong> {formatDollarAmount(filteredData[filteredData.length - 1]?.value || 0)}
                <div className="text-muted small">
                  {new Date(filteredData[filteredData.length - 1]?.date).toLocaleDateString()}
                </div>
              </div>
            </div>
            
            {showChangeMetrics && (
              <div className="d-flex justify-content-center mb-3">
                <div className={`text-center px-3 ${parseFloat(metrics.change) >= 0 ? 'text-success' : 'text-danger'}`}>
                  <div>Change</div>
                  <strong>{parseFloat(metrics.change) >= 0 ? '+' : ''}{formatDollarAmount(metrics.change)}</strong>
                </div>
                <div className={`text-center px-3 ${parseFloat(metrics.percentChange) >= 0 ? 'text-success' : 'text-danger'}`}>
                  <div>Percent Change</div>
                  <strong>{parseFloat(metrics.percentChange) >= 0 ? '+' : ''}{metrics.percentChange}%</strong>
                </div>
              </div>
            )}
            
            <div style={{ height: '300px' }}>
              <Line data={chartData} options={chartOptions} />
            </div>
            
            <div className="text-center text-muted mt-3 small">
              Portfolio value is recorded when you sync prices or take manual snapshots.
            </div>
          </Card.Body>
        </div>
      </Collapse>
    </Card>
  );
};

export default PortfolioValueChart; 