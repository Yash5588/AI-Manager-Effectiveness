const cron = require("node-cron");
const User = require("../models/User");
const { generateHRReport, generateManagerReport } = require("../services/reportService");
const { sendEmail } = require("../services/emailService");

// Run on the 1st of every month at 9:00 AM IST (3:30 AM UTC)
cron.schedule("30 3 1 * *", async () => {
    console.log("── Monthly email report job started ──");
    await sendAllReports();
});

// Core logic — also used by the manual trigger endpoint
async function sendAllReports(specificHrId = null) {
    try {
        const query = { userType: "hr" };
        if (specificHrId) {
            query._id = specificHrId;
        }

        const hrUsers = await User.find(query);
        console.log(`Found ${hrUsers.length} HR user(s) to process`);

        for (const hr of hrUsers) {
            try {
                // Send HR report
                const hrReport = await generateHRReport(hr._id);
                await sendEmail(hrReport.to, hrReport.subject, hrReport.html);
                console.log(`✓ HR report sent to ${hr.name} (${hr.email})`);

                // Send report to each manager under this HR
                const managers = await User.find({ hrId: hr._id, userType: "manager" });
                for (const mgr of managers) {
                    try {
                        const mgrReport = await generateManagerReport(mgr._id);
                        await sendEmail(mgrReport.to, mgrReport.subject, mgrReport.html);
                        console.log(`  ✓ Manager report sent to ${mgr.name} (${mgr.email})`);
                    } catch (err) {
                        console.error(`  ✗ Failed to send report to manager ${mgr.name}:`, err.message);
                    }
                }
            } catch (err) {
                console.error(`✗ Failed to process HR ${hr.name}:`, err.message);
            }
        }

        console.log("── Monthly email report job completed ──");
    } catch (err) {
        console.error("Email report job failed:", err.message);
    }
}

module.exports = { sendAllReports };
