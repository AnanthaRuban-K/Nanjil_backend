import nodemailer from "nodemailer";
import { config } from "../core/config";
import { logger } from "../core/logger";
import type { Booking } from "../models/booking";
import type { SafeUser } from "../models/user";

type NotificationMessage = {
  to: string[];
  subject: string;
  text: string;
};

function adminEmails(): string[] {
  return (config.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function bookingUrl(bookingId: string, role: "admin" | "customer" | "technician") {
  if (role === "admin") return `${config.FRONTEND_URL}/admin/bookings`;
  if (role === "technician") {
    return `${config.FRONTEND_URL}/technician/jobs/${bookingId}`;
  }
  return `${config.FRONTEND_URL}/bookings/${bookingId}`;
}

function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

class NotificationService {
  private transporter =
    config.SMTP_HOST && config.SMTP_PORT
      ? nodemailer.createTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          secure: config.SMTP_PORT === 465,
          auth:
            config.SMTP_USER && config.SMTP_PASS
              ? {
                  user: config.SMTP_USER,
                  pass: config.SMTP_PASS,
                }
              : undefined,
        })
      : null;

  private async send(message: NotificationMessage) {
    if (message.to.length === 0) {
      logger.warn("NOTIFY", `No recipients for ${message.subject}`);
      return;
    }

    if (!this.transporter) {
      logger.info("NOTIFY", `Email skipped: ${message.subject}`, {
        to: message.to,
      });
      return;
    }

    await this.transporter.sendMail({
      from: config.SMTP_FROM || config.SMTP_USER,
      to: message.to.join(","),
      subject: message.subject,
      text: message.text,
    });

    logger.info("NOTIFY", `Email sent: ${message.subject}`, {
      to: message.to,
    });
  }

  async bookingCreated(booking: Booking, customer: SafeUser | undefined) {
    await this.send({
      to: adminEmails(),
      subject: `New booking ${booking.bookingReference}`,
      text: [
        `New booking created: ${booking.bookingReference}`,
        `Service: ${booking.serviceType}`,
        `Preferred date: ${booking.preferredDate}`,
        `Customer: ${customer?.fullName ?? booking.customerId}`,
        `Phone: ${customer?.phone ?? "N/A"}`,
        `Admin view: ${bookingUrl(booking.id, "admin")}`,
        customer
          ? `WhatsApp customer: ${whatsappLink(
              customer.phone,
              `Hi ${customer.fullName}, we received your booking ${booking.bookingReference}.`
            )}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  async technicianAssigned(booking: Booking, technician: SafeUser) {
    await this.send({
      to: [technician.email],
      subject: `Job assigned ${booking.bookingReference}`,
      text: [
        `A job has been assigned to you.`,
        `Reference: ${booking.bookingReference}`,
        `Service: ${booking.serviceType}`,
        `Scheduled date: ${booking.scheduledDate ?? "Not set"}`,
        `Address: ${booking.serviceAddress}`,
        `Job view: ${bookingUrl(booking.id, "technician")}`,
      ].join("\n"),
    });
  }

  async paymentPending(booking: Booking, customer: SafeUser | undefined) {
    if (!customer) return;

    await this.send({
      to: [customer.email],
      subject: `Payment pending for ${booking.bookingReference}`,
      text: [
        `Your service is completed.`,
        `Reference: ${booking.bookingReference}`,
        `Amount: ${booking.serviceAmount ? `Rs. ${booking.serviceAmount}` : "To be confirmed"}`,
        `Pay and submit UPI reference here: ${bookingUrl(booking.id, "customer")}`,
        `WhatsApp support: ${whatsappLink(
          customer.phone,
          `Hi, I need help with payment for booking ${booking.bookingReference}.`
        )}`,
      ].join("\n"),
    });
  }

  async paymentSubmitted(booking: Booking, customer: SafeUser | undefined) {
    await this.send({
      to: adminEmails(),
      subject: `Payment submitted ${booking.bookingReference}`,
      text: [
        `Customer submitted payment for verification.`,
        `Reference: ${booking.bookingReference}`,
        `UPI reference: ${booking.submittedUpiReference ?? "N/A"}`,
        `Customer: ${customer?.fullName ?? booking.customerId}`,
        `Admin view: ${bookingUrl(booking.id, "admin")}`,
      ].join("\n"),
    });
  }

  async customerRequest(
    booking: Booking,
    customer: SafeUser | undefined,
    request: { type: "CANCEL" | "RESCHEDULE"; requestedDate?: string; note?: string }
  ) {
    await this.send({
      to: adminEmails(),
      subject: `${request.type === "CANCEL" ? "Cancel" : "Reschedule"} request ${booking.bookingReference}`,
      text: [
        `Customer requested ${request.type.toLowerCase()}.`,
        `Reference: ${booking.bookingReference}`,
        `Customer: ${customer?.fullName ?? booking.customerId}`,
        `Phone: ${customer?.phone ?? "N/A"}`,
        request.requestedDate ? `Requested date: ${request.requestedDate}` : "",
        request.note ? `Note: ${request.note}` : "",
        `Admin view: ${bookingUrl(booking.id, "admin")}`,
      ].filter(Boolean).join("\n"),
    });
  }

  async passwordReset(user: SafeUser, resetUrl: string) {
    await this.send({
      to: [user.email],
      subject: "Reset your Nanjil MEP password",
      text: [
        `Hi ${user.fullName},`,
        "",
        "We received a request to reset your password.",
        "Use this link within 15 minutes:",
        resetUrl,
        "",
        "If you did not request this, you can ignore this email.",
      ].join("\n"),
    });
  }
}

export const notificationService = new NotificationService();
