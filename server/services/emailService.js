const nodemailer = require("nodemailer");

// Gmail SMTP transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Verify connection on startup
transporter.verify((err) => {
    if (err) {
        console.error("Email transporter error:", err.message);
    } else {
        console.log("Email service ready");
    }
});

// Send a generic email
async function sendEmail(to, subject, html) {
    const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${info.messageId}`);
    return info;
}

module.exports = { sendEmail };
