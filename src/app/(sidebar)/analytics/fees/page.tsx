"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
    const response = await axios.post<FeeDataItem[]>('https://api.mercurydata.app/zephyr/execute', {
      mode: {
        Function: {
          fname: "get_last",
          arguments: "{\"lastnl\": 5}"
        }
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_MERCURY_JWT}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Handle Axios-specific errors
      console.error('Axios error:', error.response?.data || error.message);
    } else {
      // Handle non-Axios errors
      console.error('Unexpected error:', error);
    }
    // Optionally, you can throw the error again or return a default value
    throw error;
    // Or return a default value: return [];
  }
}

const SorobanContractExplorer: React.FC = () => {
  const [feeData, setFeeData] = useState<FeeDataItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const data = await fetchFeeData();
      setFeeData(data);
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
        text: 'Fee Analytics',
      },
    },
  };

  const data = {
    labels: feeData.map(item => new Date(item.time_st * 1000).toLocaleTimeString()),
    datasets: [
      {
        label: 'Classic Fees',
        data: feeData.map(item => item.classic),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
    ],
  };

  return (
    <div>
      <h1>Fee Analytics</h1>
      {feeData.length > 0 ? (
        <Line options={options} data={data} />
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}

export default SorobanContractExplorer;