import React from "react";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

const PieChart = ({ income, expense }) => {

  const data = {
    labels: ["Income", "Expense"],
    datasets: [
      {
        data: [income, expense],
        backgroundColor: [
          "#22c55e",
          "#ef4444"
        ],
        hoverBackgroundColor: [
          "#16a34a",
          "#dc2626"
        ],
        borderColor: "#ffffff",
        borderWidth: 2,
        hoverOffset: 12
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#374151",
          font: {
            size: 14,
            weight: "bold"
          },
          padding: 20
        }
      },

      tooltip: {
        backgroundColor: "#111827",
        titleColor: "#fff",
        bodyColor: "#fff",
        padding: 12,
        cornerRadius: 8
      }
    },

    animation: {
      animateRotate: true,
      animateScale: true
    }
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "550px",
        height: "340px",
        margin: "25px auto",
        background: "#ffffff",
        borderRadius: "18px",
        padding: "20px",
        boxShadow: "0 10px 25px rgba(0,0,0,.12)"
      }}
    >
      <h2
        style={{
          textAlign: "center",
          marginBottom: "15px",
          color: "#2563eb",
          fontSize: "22px",
          fontWeight: "700"
        }}
      >
        Income vs Expense
      </h2>

      <Pie
        data={data}
        options={options}
      />
    </div>
  );

};

export default PieChart;