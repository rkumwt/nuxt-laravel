import nodemailer from "nodemailer";
import type { AppConfig } from "../config/env.js";
import type { Logger } from "../lib/logger.js";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

// Strategy: the app depends on this interface, the transport is chosen by config
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export class SmtpMailer implements Mailer {
  private readonly transport;

  constructor(private readonly mailConfig: AppConfig["mail"]) {
    this.transport = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.port === 465,
      auth: mailConfig.username
        ? { user: mailConfig.username, pass: mailConfig.password }
        : undefined,
    });
  }

  async send({ to, subject, html }: MailMessage) {
    await this.transport.sendMail({
      from: { name: this.mailConfig.from.name, address: this.mailConfig.from.address },
      to,
      subject,
      html,
    });
  }
}

// MAIL_MAILER=log: write emails to the log instead of sending them
export class LogMailer implements Mailer {
  constructor(private readonly logger: Logger) {}

  async send(message: MailMessage) {
    this.logger.info({ mail: message }, `Mail to ${message.to}: ${message.subject}`);
  }
}

export const createMailer = (mailConfig: AppConfig["mail"], logger: Logger): Mailer =>
  mailConfig.mailer === "smtp" ? new SmtpMailer(mailConfig) : new LogMailer(logger);
