process.env.OPENAI_API_KEY = "dummy";
const { toggleActionableCompletion } = require("./services/employeeActionablesService");
const { slugify } = require("./services/employeeActionablesService"); // Assuming it's exported or I can mock it

// Mock suggestions with the NEW unified ID format
const employeeName = "John Doe";
const employeeIndex = 0;
const suggestionIndex = 0;
// const baseId = slugify(`${employeeName}-${employeeIndex}-${suggestionIndex}`);
// Since I can't easily export slugify from some modules without side effects, I'll just use the expected output
const baseId = "john-doe-0-0";

const mockSuggestions = [
    {
        employeeName,
        suggestions: [
            {
                title: "Improve communication",
                actionables: [
                    { id: `${baseId}-act-0`, title: "Plan", completed: false },
                    { id: `${baseId}-act-1`, title: "Review", completed: false }
                ]
            }
        ]
    }
];

function testToggle() {
    console.log("Testing toggleActionableCompletion with UNIFIED IDs...");

    const targetId = "john-doe-0-0-act-0";
    console.log(`Toggling ID: ${targetId} to true`);

    const result = toggleActionableCompletion(mockSuggestions, targetId, true);

    if (result.changed) {
        console.log("✅ Success: Actionable was found and changed");
    } else {
        console.error("❌ Failure: Actionable not found. IDs in mock:",
            mockSuggestions[0].suggestions[0].actionables.map(a => a.id));
    }
}

testToggle();
