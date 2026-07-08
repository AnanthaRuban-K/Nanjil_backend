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

const REQUIRED_ADMIN_EMAILS = [
  "kannan@nanjilmepservice.com",
  "thangarethinam@nanjilmepservice.com",
  "vengadeshs@nanjilmepservice.com",
];

function adminEmails(): string[] {
  return [...REQUIRED_ADMIN_EMAILS, ...(config.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean)]
    .filter((email, index, emails) => emails.indexOf(email) === index);
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

  async customerBookingCreated(booking: Booking, customer: SafeUser | undefined) {
    if (!customer) return;

    await this.send({
      to: [customer.email],
      subject: `Booking received ${booking.bookingReference}`,
      text: [
        `Hi ${customer.fullName},`,
        "",
        `We received your booking ${booking.bookingReference}.`,
        `Service: ${booking.serviceType}`,
        `Preferred date: ${booking.preferredDate}`,
        `Booking view: ${bookingUrl(booking.id, "customer")}`,
        "",
        "Our admin team will review it and update you shortly.",
      ].join("\n"),
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

  async bookingStatusChanged(
    booking: Booking,
    customer: SafeUser | undefined,
    statusLabel: string,
    note?: string
  ) {
    const recipients = [...adminEmails(), ...(customer ? [customer.email] : [])]
      .filter((email, index, emails) => emails.indexOf(email) === index);

    await this.send({
      to: recipients,
      subject: `Booking ${statusLabel} ${booking.bookingReference}`,
      text: [
        `Booking update: ${booking.bookingReference}`,
        `Status: ${statusLabel}`,
        `Service: ${booking.serviceType}`,
        booking.scheduledDate ? `Scheduled date: ${booking.scheduledDate}` : "",
        note || "",
        customer ? `Customer: ${customer.fullName}` : "",
        customer ? `Phone: ${customer.phone}` : "",
        `Admin view: ${bookingUrl(booking.id, "admin")}`,
        customer ? `Customer view: ${bookingUrl(booking.id, "customer")}` : "",
      ].filter(Boolean).join("\n"),
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
      to: [...adminEmails(), ...(customer ? [customer.email] : [])]
        .filter((email, index, emails) => emails.indexOf(email) === index),
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

  async paymentVerified(
    booking: Booking,
    customer: SafeUser | undefined,
    payment: { amount: string; paymentMode: string; invoiceNumber: string }
  ) {
    const recipients = [...adminEmails(), ...(customer ? [customer.email] : [])]
      .filter((email, index, emails) => emails.indexOf(email) === index);

    await this.send({
      to: recipients,
      subject: `Payment verified ${booking.bookingReference}`,
      text: [
        `Payment verified for ${booking.bookingReference}.`,
        `Invoice: ${payment.invoiceNumber}`,
        `Amount: Rs. ${payment.amount}`,
        `Mode: ${payment.paymentMode}`,
        customer ? `Customer: ${customer.fullName}` : "",
        `Admin view: ${bookingUrl(booking.id, "admin")}`,
        customer ? `Customer receipt: ${bookingUrl(booking.id, "customer")}` : "",
      ].filter(Boolean).join("\n"),
    });
  }

  async paymentRejected(booking: Booking, customer: SafeUser | undefined) {
    const recipients = [...adminEmails(), ...(customer ? [customer.email] : [])]
      .filter((email, index, emails) => emails.indexOf(email) === index);

    await this.send({
      to: recipients,
      subject: `Payment rejected ${booking.bookingReference}`,
      text: [
        `Payment submission was rejected for ${booking.bookingReference}.`,
        booking.paymentRejectedReason
          ? `Reason: ${booking.paymentRejectedReason}`
          : "",
        customer ? `Customer: ${customer.fullName}` : "",
        `Admin view: ${bookingUrl(booking.id, "admin")}`,
        customer ? `Customer view: ${bookingUrl(booking.id, "customer")}` : "",
      ].filter(Boolean).join("\n"),
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

  async customerRequestConfirmation(
    booking: Booking,
    customer: SafeUser | undefined,
    request: { type: "CANCEL" | "RESCHEDULE"; requestedDate?: string; note?: string }
  ) {
    if (!customer) return;

    const action = request.type === "CANCEL" ? "cancel" : "reschedule";

    await this.send({
      to: [customer.email],
      subject: `${action[0].toUpperCase()}${action.slice(1)} request received ${booking.bookingReference}`,
      text: [
        `Hi ${customer.fullName},`,
        "",
        `We received your ${action} request for ${booking.bookingReference}.`,
        request.requestedDate ? `Requested date: ${request.requestedDate}` : "",
        request.note ? `Note: ${request.note}` : "",
        `Booking view: ${bookingUrl(booking.id, "customer")}`,
        "",
        "Our admin team will review it and update you shortly.",
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

  async accountCreated(user: SafeUser, temporaryPassword?: string) {
    await this.send({
      to: [user.email],
      subject: "Your Nanjil MEP account is ready",
      text: [
        `Hi ${user.fullName},`,
        "",
        `Your ${user.role.toLowerCase()} account has been created.`,
        `Login: ${config.FRONTEND_URL}/login`,
        `Email: ${user.email}`,
        temporaryPassword ? `Temporary password: ${temporaryPassword}` : "",
        "",
        "Please change your password after first login.",
      ].filter(Boolean).join("\n"),
    });
  }
}

export const notificationService = new NotificationService();
