import "dotenv/config";
import nodemailer from "nodemailer";
import { config } from "../src/core/config";

const REQUIRED_ADMIN_EMAILS = [
  "kannan@nanjilmepservice.com",
  "thangarethinam@nanjilmepservice.com",
  "vengadeshs@nanjilmepservice.com",
];

function adminEmails() {
  return [...REQUIRED_ADMIN_EMAILS, ...(config.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean)]
    .filter((email, index, emails) => emails.indexOf(email) === index);
}

async function main() {
  const recipients = adminEmails();

  console.log("Notification config audit");
  console.log(`NODE_ENV=${config.NODE_ENV}`);
  console.log(`FRONTEND_URL=${config.FRONTEND_URL}`);
  console.log(`SMTP_HOST=${config.SMTP_HOST || "<not set>"}`);
  console.log(`SMTP_PORT=${config.SMTP_PORT || "<not set>"}`);
  console.log(`SMTP_USER=${config.SMTP_USER || "<not set>"}`);
  console.log(`SMTP_FROM=${config.SMTP_FROM || config.SMTP_USER || "<not set>"}`);
  console.log("Effective admin booking recipients:");
  for (const recipient of recipients) {
    console.log(`- ${recipient}`);
  }

  if (process.env.SEND_TEST_EMAIL !== "true") {
    console.log("");
    console.log("Set SEND_TEST_EMAIL=true to send a test notification email.");
    return;
  }

  if (!config.SMTP_HOST || !config.SMTP_PORT) {
    throw new Error("SMTP_HOST and SMTP_PORT are required to send a test email");
  }

  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth:
      config.SMTP_USER && config.SMTP_PASS
        ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
        : undefined,
  });

  await transporter.sendMail({
    from: config.SMTP_FROM || config.SMTP_USER,
    to: recipients.join(","),
    subject: "Nanjil MEP admin notification test",
    text: [
      "This is a test email from Nanjil MEP backend.",
      "",
      "If you received this, admin booking notifications are configured for this address.",
    ].join("\n"),
  });

  console.log("");
  console.log("Test email sent.");
}

main().catch((error) => {
  console.error("Notification config audit failed:", error.message);
  process.exit(1);
});
