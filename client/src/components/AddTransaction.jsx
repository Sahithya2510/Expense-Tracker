import { useState } from "react";
import api from "../services/api";

function AddTransaction({ fetchTransactions }) {
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    type: "income",
    category: "",
    date: "",
    description: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem("token");

      const res = await api.post(
        "/transactions",
        {
          ...formData,
          amount: Number(formData.amount),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log(res.data);
      alert("Transaction Added Successfully");

      setFormData({
        title: "",
        amount: "",
        type: "income",
        category: "",
        date: "",
        description: "",
      });

      if (fetchTransactions) {
        fetchTransactions();
      }
    } catch (error) {
      console.log(error.response);
      alert(error.response?.data?.message || error.message);
    }
  };

  return (
    <div className="card p-4 mt-4 shadow">
      <h3 className="text-center mb-3">Add Transaction</h3>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="title"
          className="form-control mb-2"
          placeholder="Title"
          value={formData.title}
          onChange={handleChange}
          required
        />

        <input
          type="number"
          name="amount"
          className="form-control mb-2"
          placeholder="Amount"
          value={formData.amount}
          onChange={handleChange}
          required
        />

        <select
          name="type"
          className="form-control mb-2"
          value={formData.type}
          onChange={handleChange}
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>

        <input
          type="text"
          name="category"
          className="form-control mb-2"
          placeholder="Category"
          value={formData.category}
          onChange={handleChange}
          required
        />

        <input
          type="date"
          name="date"
          className="form-control mb-2"
          value={formData.date}
          onChange={handleChange}
          required
        />

        <textarea
          name="description"
          className="form-control mb-3"
          placeholder="Description"
          value={formData.description}
          onChange={handleChange}
        />

        <button type="submit" className="btn btn-success w-100">
          Save Transaction
        </button>
      </form>
    </div>
  );
}

export default AddTransaction;