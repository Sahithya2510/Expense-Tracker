import axios from "axios";

const api = axios.create({
  baseURL: "http://expense-tracker-api-jvzj.onrender.com/api",
});

export default api;