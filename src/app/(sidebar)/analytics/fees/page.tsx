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
  classic: number;
  contracts: number;
  other: number;
}

async function fetchFeeData(): Promise<FeeDataItem[]> {
  try {

    console.log("Fetching Response started")
    const response = await fetch('https://api.mercurydata.app/zephyr/execute', {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'User-Agent': 'Thunder Client (https://www.thunderclient.com)',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiaHVudGVyZmlyc3QiLCJleHAiOjE3MjM1NTUyODksInVzZXJfaWQiOjEwMywidXNlcm5hbWUiOiJyYWh1bC5zb3NodGU0N0BnbWFpbC5jb20iLCJpYXQiOjE3MjI5NTA0ODgsImF1ZCI6InBvc3RncmFwaGlsZSIsImlzcyI6InBvc3RncmFwaGlsZSJ9.iZXJG0IK-F5ikqDtDAbEpjMp6ZGavSYicujuAi6dcNI`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mode: {
          Function: {
            fname: "get_last",
            arguments: "{\"lastnl\": 5}"
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
  const [feeData, setFeeData] = useState<FeeDataItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchFeeData();
        setFeeData(data);
        setError(null); // Clear any previous errors
      } catch (error) {
        setError('Failed to fetch fee data.');
        console.error('Error fetching fee data:', error);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 5000);

    return () => clearInterval(intervalId);
  }, []);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Average Fees (Last 5 Ledgers)',
      },
    },
  };

  const data = {
    labels: feeData.map(item => new Date(item.time_st * 1000).toLocaleTimeString()),
    datasets: [
      {
        label: 'Classic Tx Fees',
        data: feeData.map(item => item.classic),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
      {
        label: 'Contracts Tx Fees',
        data: feeData.map(item => item.contracts),
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
      },
      {
        label: 'Other Tx Fees',
        data: feeData.map(item => item.other),
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.5)',
      }
    ],
  };

  return (
    <div>
      <h1>Fee Analytics</h1>
      {error ? (
        <p>{error}</p>
      ) : (
        feeData.length > 0 ? (
          <Line options={options} data={data} />
        ) : (
          <p>Loading...</p>
        )
      )}
    </div>
  );
}

export default SorobanContractExplorer;
