import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { mailConfig } from '../../config/mail.config.js';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

// Strategy: services depend on this interface (injected with the MAILER
// token); the transport is chosen by MAIL_MAILER
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export const MAILER = Symbol('MAILER');

export class SmtpMailer implements Mailer {
  private readonly transport: Transporter;

  constructor(private readonly config: ConfigType<typeof mailConfig>) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: config.username
        ? { user: config.username, pass: config.password }
        : undefined,
    });
  }

  async send({ to, subject, html }: MailMessage) {
    await this.transport.sendMail({
      from: { name: this.config.from.name, address: this.config.from.address },
      to,
      subject,
      html,
    });
  }
}

// MAIL_MAILER=log: write emails to the log instead of sending them
export class LogMailer implements Mailer {
  private readonly logger = new Logger('Mail');

  async send(message: MailMessage) {
    this.logger.log(
      { mail: message },
      `Mail to ${message.to}: ${message.subject}`,
    );
  }
}
