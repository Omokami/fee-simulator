"use client";

import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface FeeDataItem {
  time_st: number;
  avg_s: string;
  avg_c: string;
}

async function fetchFeeData(lastNLedgers: number): Promise<FeeDataItem[]> {
  try {
    console.log("Fetching Response started");
    const response = await fetch('https://mainnet.mercurydata.app/zephyr/execute', {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'User-Agent': 'Thunder Client (https://www.thunderclient.com)',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_MERCURY_JWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mode: {
          Function: {
            fname: "get_last",
            arguments: JSON.stringify({ lastnl: lastNLedgers })
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: FeeDataItem[] = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

const SorobanContractExplorer: React.FC = () => {
  const [last5Ledgers, setLast5Ledgers] = useState<FeeDataItem[]>([]);
  const [last30Ledgers, setLast30Ledgers] = useState<FeeDataItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLast5Ledgers = async () => {
      try {
        const last5 = await fetchFeeData(5);
        setLast5Ledgers(last5);
        setError(null); // Clear any previous errors
      } catch (error) {
        setError('Failed to fetch fee data for last 5 ledgers.');
        console.error('Error fetching fee data:', error);
      }
    };

    const fetchLast30Ledgers = async () => {
      try {
        const last30 = await fetchFeeData(30);
        setLast30Ledgers(last30);
        setError(null); // Clear any previous errors
      } catch (error) {
        setError('Failed to fetch fee data for last 30 ledgers.');
        console.error('Error fetching fee data:', error);
      }
    };

    fetchLast5Ledgers();
    const last5LedgersInterval = setInterval(fetchLast5Ledgers, 5000);

    fetchLast30Ledgers();
    const last30LedgersInterval = setInterval(fetchLast30Ledgers, 60000);

    return () => {
      clearInterval(last5LedgersInterval);
      clearInterval(last30LedgersInterval);
    };
  }, []);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  const last5LedgersClassicChart = {
    labels: last5Ledgers.map(item => new Date(item.time_st * 1000).toLocaleTimeString()),
    datasets: [
      {
        label: 'Classic Tx Avg Fee (In Stroops)',
        data: last5Ledgers.map(item => parseFloat(item.avg_c)),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
    ],
  };

  const last5LedgersSorobanChart = {
    labels: last5Ledgers.map(item => new Date(item.time_st * 1000).toLocaleTimeString()),
    datasets: [
      {
        label: 'Soroban Tx Avg Fees (In Stroops)',
        data: last5Ledgers.map(item => parseFloat(item.avg_s)),
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
      },
    ],
  };

  const last30LedgersClassicChart = {
    labels: last30Ledgers.map(item => new Date(item.time_st * 1000).toLocaleTimeString()),
    datasets: [
      {
        label: 'Classic Tx Avg Fee (In Stroops)',
        data: last30Ledgers.map(item => parseFloat(item.avg_c)),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
    ],
  };

  const last30LedgersSorobanChart = {
    labels: last30Ledgers.map(item => new Date(item.time_st * 1000).toLocaleTimeString()),
    datasets: [
      {
        label: 'Soroban Tx Avg Fees (In Stroops)',
        data: last30Ledgers.map(item => parseFloat(item.avg_s)),
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
      },
    ],
  };

  return (
    <div>
      <h1>Fee Analytics (Mainnet)</h1>
      {error ? (
        <p>{error}</p>
      ) : (
        <>
          <div>
            <h2>Last 5 Ledgers - Classic Tx Avg Fee</h2>
            <p><i>**data pulled from a custom zephyr program</i></p>
            {last5Ledgers.length > 0 && (
              <Line options={options} data={last5LedgersClassicChart} />
            )}
          </div>
          <div>
            <h2>Last 5 Ledgers - Soroban Tx Avg Fees</h2>
            <p><i>**data pulled from a custom zephyr program</i></p>
            {last5Ledgers.length > 0 && (
              <Line options={options} data={last5LedgersSorobanChart} />
            )}
          </div>
          <div>
            <h2>Last 30 Ledgers - Classic Tx Avg Fee</h2>
            <p><i>**data pulled from a custom zephyr program</i></p>
            {last30Ledgers.length > 0 && (
              <Line options={options} data={last30LedgersClassicChart} />
            )}
          </div>
          <div>
            <h2>Last 30 Ledgers - Soroban Tx Avg Fees</h2>
            <p><i>**data pulled from a custom zephyr program</i></p>
            {last30Ledgers.length > 0 && (
              <Line options={options} data={last30LedgersSorobanChart} />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SorobanContractExplorer;