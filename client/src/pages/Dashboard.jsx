import React, { useState, useEffect } from "react";
import api from "../services/api";
import PieChart from "../components/PieChart";
import BarChart from "../components/BarChart";
import "../styles/dashboard.css";
import { useNavigate } from "react-router-dom";
import BillScanner from "../components/BillScanner";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const Dashboard = () => {

  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState("");

  const [transactions, setTransactions] = useState([]);

  const [search, setSearch] = useState("");

  const [filterType, setFilterType] = useState("all");

  const [filterCategory, setFilterCategory] = useState("all");

  const [darkMode, setDarkMode] = useState(false);

  const [transaction, setTransaction] = useState({
    title: "",
    amount: "",
    type: "income",
    category: "",
    date: "",
    description: "",
  });

  useEffect(() => {
    fetchTransactions();
  }, []);
  const navigate = useNavigate();

  const fetchTransactions = async () => {
    try {

      const token = localStorage.getItem("token");

      const res = await api.get("/transactions", 
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setTransactions(res.data);

    } catch (error) {
      console.log(error);
    }
  };

  const handleChange = (e) => {
    setTransaction({
      ...transaction,
      [e.target.name]: e.target.value,
    });
  };

  const clearForm = () => {

    setTransaction({
      title: "",
      amount: "",
      type: "income",
      category: "",
      date: "",
      description: "",
    });

    setShowForm(false);
    setIsEditing(false);
    setEditId("");

  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  navigate("/login");
};

  const categories = [
    ...new Set(transactions.map((t) => t.category))
  ];

  const filteredTransactions = transactions.filter((item) => {

    const searchMatch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());

    const typeMatch =
      filterType === "all" ||
      item.type === filterType;

    const categoryMatch =
      filterCategory === "all" ||
      item.category === filterCategory;

    return (
      searchMatch &&
      typeMatch &&
      categoryMatch
    );

  });
  // =========================
// ADD / UPDATE TRANSACTION
// =========================
const handleSave = async () => {
  try {
    const token = localStorage.getItem("token");

    if (isEditing) {
      await api.put(
    `/transactions/${editId}`,
        {
          ...transaction,
          amount: Number(transaction.amount),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      alert("Transaction Updated Successfully");
    } else {
      await api.post(
    "/transactions",
        {
          ...transaction,
          amount: Number(transaction.amount),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      alert("Transaction Added Successfully");
    }

    clearForm();
    fetchTransactions();

  } catch (error) {
    alert(error.response?.data?.message || error.message);
  }
};


// =========================
// DELETE TRANSACTION
// =========================
const handleDelete = async (id) => {

  if (!window.confirm("Delete this transaction?")) return;

  try {

    const token = localStorage.getItem("token");
await api.delete(
    `/transactions/${id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    alert("Transaction Deleted Successfully");

    fetchTransactions();

  } catch (error) {

    alert(error.response?.data?.message || error.message);

  }

};

// =========================
// EDIT TRANSACTION
// =========================
const handleEdit = (item) => {

  setTransaction({
    title: item.title,
    amount: item.amount,
    type: item.type,
    category: item.category,
    date: item.date.substring(0,10),
    description: item.description,
  });

  setEditId(item._id);
  setIsEditing(true);
  setShowForm(true);

};

// =========================
// EXPORT PDF
// =========================
const exportPDF = () => {

  const doc = new jsPDF();

  doc.text("Expense Tracker Report",14,15);

  autoTable(doc,{
    head:[
      [
        "Title",
        "Category",
        "Amount",
        "Type",
        "Date"
      ]
    ],

    body: filteredTransactions.map((t)=>[
      t.title,
      t.category,
      `₹${t.amount}`,
      t.type,
      new Date(t.date).toLocaleDateString()
    ])
  });

  doc.save("ExpenseReport.pdf");

};

// =========================
// EXPORT EXCEL
// =========================
const exportExcel = () => {

  const worksheet = XLSX.utils.json_to_sheet(
    filteredTransactions
  );

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Transactions"
  );

  const excelBuffer =
    XLSX.write(
      workbook,
      {
        bookType:"xlsx",
        type:"array",
      }
    );

  const data = new Blob(
    [excelBuffer],
    {
      type:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8"
    }
  );

  saveAs(
    data,
    "ExpenseReport.xlsx"
  );

};

// =========================
// SUMMARY CARDS
// =========================
const income = filteredTransactions
.filter(t=>t.type==="income")
.reduce((sum,t)=>sum+t.amount,0);

const expense = filteredTransactions
.filter(t=>t.type==="expense")
.reduce((sum,t)=>sum+t.amount,0);

const balance = income-expense;
return (
<div className={darkMode ? "dashboard dark" : "dashboard"}>

<div className="top-bar">

<h2>Expense Tracker Dashboard</h2>

<div>

<button
className="dark-btn"
onClick={toggleDarkMode}
>
{darkMode ? "☀ Light" : "🌙 Dark"}
</button>

<button
className="logout-btn"
onClick={logout}
>
Logout
</button>

</div>

</div>

<div className="cards">

<div className="card balance">
<h3>Total Balance</h3>
<h2>₹{balance}</h2>
</div>

<div className="card income">
<h3>Total Income</h3>
<h2>₹{income}</h2>
</div>

<div className="card expense">
<h3>Total Expense</h3>
<h2>₹{expense}</h2>
</div>

</div>

<div className="toolbar">

<input
type="text"
placeholder="🔍 Search..."
value={search}
onChange={(e)=>setSearch(e.target.value)}
className="search-box"
/>

<select
value={filterType}
onChange={(e)=>setFilterType(e.target.value)}
className="filter-box"
>
<option value="all">All Types</option>
<option value="income">Income</option>
<option value="expense">Expense</option>
</select>

<select
value={filterCategory}
onChange={(e)=>setFilterCategory(e.target.value)}
className="filter-box"
>
<option value="all">All Categories</option>

{categories.map((cat,index)=>(
<option
key={index}
value={cat}
>
{cat}
</option>
))}

</select>

<button
className="pdf-btn"
onClick={exportPDF}
>
Export PDF
</button>

<button
className="excel-btn"
onClick={exportExcel}
>
Export Excel
</button>

<button
className="add-btn2"
onClick={()=>{
clearForm();
setShowForm(true);
}}
>
+ Add Transaction
</button>
<BillScanner
  fetchTransactions={fetchTransactions}
/>

</div>

{showForm && (

<div className="transaction-form">

<h3>
{isEditing
?
"Edit Transaction"
:
"Add Transaction"}
</h3>

<input
type="text"
name="title"
placeholder="Title"
value={transaction.title}
onChange={handleChange}
/>

<input
type="number"
name="amount"
placeholder="Amount"
value={transaction.amount}
onChange={handleChange}
/>

<select
name="type"
value={transaction.type}
onChange={handleChange}
>
<option value="income">
Income
</option>

<option value="expense">
Expense
</option>

</select>

<input
type="text"
name="category"
placeholder="Category"
value={transaction.category}
onChange={handleChange}
/>

<input
type="date"
name="date"
value={transaction.date}
onChange={handleChange}
/>

<textarea
name="description"
placeholder="Description"
value={transaction.description}
onChange={handleChange}
/>

<div className="buttons">

<button onClick={handleSave}>
{isEditing
?
"Update"
:
"Save"}
</button>

<button
className="cancel"
onClick={clearForm}
>
Cancel
</button>

</div>

</div>

)}

<PieChart
income={income}
expense={expense}
/>

<BarChart
transactions={filteredTransactions}
/>

<div className="transactions">

<h3>Recent Transactions</h3>

<table>

<thead>

<tr>

<th>Title</th>

<th>Category</th>

<th>Amount</th>

<th>Type</th>

<th>Date</th>

<th>Action</th>

</tr>

</thead>

<tbody>
{filteredTransactions.length === 0 ? (

<tr>
<td
colSpan="6"
style={{
textAlign:"center",
padding:"20px"
}}
>
No Transactions Found
</td>
</tr>

) : (

filteredTransactions.map((t)=>(

<tr key={t._id}>

<td>{t.title}</td>

<td>{t.category}</td>

<td>
₹{t.amount}
</td>

<td
style={{
color:
t.type==="income"
?
"green"
:
"red",

fontWeight:"bold"
}}
>
{t.type}
</td>

<td>
{new Date(t.date).toLocaleDateString()}
</td>

<td>

<button
className="edit-btn"
onClick={()=>handleEdit(t)}
>
✏ Edit
</button>

<button
className="delete-btn"
onClick={()=>handleDelete(t._id)}
>
🗑 Delete
</button>

</td>

</tr>

))

)}

</tbody>

</table>


</div>

</div>
);

};

export default Dashboard;