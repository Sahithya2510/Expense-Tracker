import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const BarChart = ({ transactions }) => {

  const income = new Array(12).fill(0);
  const expense = new Array(12).fill(0);

  transactions.forEach((item) => {

    const month = new Date(item.date).getMonth();

    if (item.type === "income") {
      income[month] += Number(item.amount);
    } else {
      expense[month] += Number(item.amount);
    }

  });

  const data = {
    labels: [
      "Jan","Feb","Mar","Apr","May","Jun",
      "Jul","Aug","Sep","Oct","Nov","Dec"
    ],
    datasets: [
      {
        label: "Income",
        data: income,
        backgroundColor: "#22c55e",
        borderRadius: 8,
        borderSkipped: false,
        barThickness: 18
      },
      {
        label: "Expense",
        data: expense,
        backgroundColor: "#ef4444",
        borderRadius: 8,
        borderSkipped: false,
        barThickness: 18
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {

      legend: {
        position: "top",
        labels: {
          color: "#374151",
          font: {
            size: 14,
            weight: "bold"
          },
          padding: 20
        }
      },

      title: {
        display: false
      },

      tooltip: {
        backgroundColor: "#111827",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        padding: 12,
        cornerRadius: 8
      }

    },

    scales: {

      x: {
        grid: {
          display: false
        },
        ticks: {
          color: "#6b7280",
          font: {
            size: 13
          }
        }
      },

      y: {
        beginAtZero: true,
        grid: {
          color: "#e5e7eb"
        },
        ticks: {
          color: "#6b7280",
          font: {
            size: 13
          }
        }
      }

    },

    animation: {
      duration: 1200
    }

  };

  return (

    <div
      style={{
        width: "100%",
        maxWidth: "900px",
        height: "380px",
        margin: "25px auto",
        background: "#ffffff",
        padding: "20px",
        borderRadius: "18px",
        boxShadow: "0 10px 25px rgba(0,0,0,.12)"
      }}
    >

      <h2
        style={{
          textAlign: "center",
          marginBottom: "20px",
          color: "#2563eb",
          fontSize: "22px",
          fontWeight: "700"
        }}
      >
        Monthly Income vs Expense
      </h2>

      <Bar
        data={data}
        options={options}
      />

    </div>

  );

};

export default BarChart;