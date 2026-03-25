const mongoose = require("mongoose");

const employeeSuggestionsCacheSchema = new mongoose.Schema(
    {
        managerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: 1,
        },
        suggestions: {
            type: [mongoose.Schema.Types.Mixed],
        },
        currentScore: {
            type: Number,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("EmployeeSuggestionsCache", employeeSuggestionsCacheSchema);
