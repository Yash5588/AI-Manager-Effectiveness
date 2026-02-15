const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// app.use("/api/users", require("./routes/userRoutes"));

app.use("/api/managers", require("./routes/managerRoutes"));
app.use("/api/employees", require("./routes/employeeRoutes"));
app.use("/api/feedback", require("./routes/feedbackRoutes"));
app.use("/api/metrics", require("./routes/metricRoutes"));
app.use("/api/manager-analytics", require("./routes/managerAnalyticsRoutes"));

app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);
