import axios from "axios";

const api = axios.create({
  baseURL: "https://expense-tracker-api-jvzj.onrender.com/api",
});

export default api;