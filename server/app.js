const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const connectDB = require("./config/db");

const app = express();

app.use(cors());
app.use(express.json());

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(503).json({
      message: "Database connection unavailable",
      error: error.message,
    });
  }
});

app.get("/", (req, res) => {
  res.send("Manager Effectiveness API running");
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/managers", require("./routes/managerRoutes"));
app.use("/api/employees", require("./routes/employeeRoutes"));
app.use("/api/feedback", require("./routes/feedbackRoutes"));
app.use("/api/metrics", require("./routes/metricRoutes"));
app.use("/api/manager-analytics", require("./routes/managerAnalyticsRoutes"));
app.use("/api/score-snapshots", require("./routes/scoreSnapshotRoutes"));
app.use("/api/hr", require("./routes/hrRoutes"));

module.exports = app;
