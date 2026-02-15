const Manager = require("../models/Manager");
const Employee = require("../models/Employee");
const Feedback = require("../models/Feedback");
const PerformanceMetric = require("../models/PerformanceMetric");

exports.getManagerAnalytics = async (req, res) => {
  try {
    const { managerId } = req.params;

    // 1️⃣ Fetch manager info
    const manager = await Manager.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    // 2️⃣ Fetch employees under this manager
    const employees = await Employee.find({ managerId });

    // 3️⃣ Fetch feedback related to this manager
    const feedbacks = await Feedback.find({ managerId });

    // 4️⃣ Fetch performance metrics
    const metrics = await PerformanceMetric.find({ managerId });

    // 5️⃣ Combine everything
    const analyticsData = {
      manager,
      employees,
      feedbacks,
      metrics
    };

    res.json(analyticsData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
