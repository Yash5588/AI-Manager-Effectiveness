const mongoose = require("mongoose");

const employeeSuggestionsCacheSchema = new mongoose.Schema({
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    suggestions: { type: mongoose.Schema.Types.Mixed, default: [] },
    currentScore: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("EmployeeSuggestionsCache", employeeSuggestionsCacheSchema);
