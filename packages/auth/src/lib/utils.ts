"use server"

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') })

import ejs from 'ejs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

import { redis } from '@zero-deploy/redis'

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    service: process.env.SMTP_SERVICE,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderEmailTemplate = async (templateName: string, data: any): Promise<string> => {
    const templatePath = path.join(
        __dirname,
        "email-templates",
        `${templateName}.ejs`
    )
    return ejs.renderFile(templatePath, data);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sendEmail = async (to: string, subject: string, templateName: string, data: any) => {
    try {
        const html = await renderEmailTemplate(templateName, data);
        await transporter.sendMail({
            from: `ashish.j@gradguide.in`,
            to,
            subject,
            html,
        });
        return true;
    } catch {
        return false;
    }
};

const sendOtpEmail = async (email: string, name: string, otp: string): Promise<boolean> => {
    return sendEmail(email, "Your verification code", "otp-verification", {
        name,
        otp,
        expiryTime: "5 minutes",
    });
};

export const checkOtpRestrictions = async (email: string) => {
    if (await redis.get(`otp_lock:${email}`)) return new Error("Account locked due to multiple failed attempts! Try again after 30 minutes.");
    if (await redis.get(`otp_spam_lock:${email}`)) return new Error("Too many OTP requests! Please wait an hour before requesting again.");
    if (await redis.get(`otp_cooldown:${email}`)) return new Error("Please wait a minute before requesting a new OTP.");
};

export const trackOtpRequests = async (email: string) => {
    const otpRequestKey = `otp_request_count:${email}`
    const otpRequests = parseInt((await redis.get(otpRequestKey)) || "0");
    if (otpRequests >= 2) {
        await redis.set(`otp_spam_lock:${email}`, "locked", "EX", 3600);
        return new Error("Too many OTP requests! Please wait an hour before requesting again.")
    };
    await redis.set(otpRequestKey, otpRequests + 1, "EX", 3600);
};

export const sendOtp = async (name: string, email: string) => {
    const otp = crypto.randomInt(100000, 999999).toString();

    const sent = await sendOtpEmail(email, name, otp);
    if (!sent) throw new Error("Failed to send OTP via email.");

    await redis.set(`otp:${email}`, otp, "EX", 300);
    await redis.set(`otp_cooldown:${email}`, "true", "EX", 60);
};

export const verifyOtp = async (email: string, otp: string) => {
    const storedOtp = await redis.get(`otp:${email}`);
    if (!storedOtp) throw new Error("Invalid or expired OTP!");

    const failedAttemptsKey = `otp_attempts:${email}`;
    const failedAttempts = parseInt((await redis.get(failedAttemptsKey)) || "0");

    if (storedOtp !== otp) {
        if (failedAttempts >= 2) {
            await redis.set(`otp_lock:${email}`, "locked", "EX", 1800);
            await redis.del(`otp:${email}`, failedAttemptsKey);
            throw new Error("Too many failed attempts. Account locked for 30 minutes!");
        }
        await redis.set(failedAttemptsKey, failedAttempts + 1, "EX", 300);
        throw new Error(`Incorrect OTP. ${2 - failedAttempts} attempt(s) left.`);
    }

    await redis.del(`otp:${email}`, failedAttemptsKey);
};

export const sendPasswordResetEmail = async ({
    name,
    email,
    resetToken,
}: {
    name: string;
    email: string;
    resetToken: string;
}) => {
    const resetUrl = `http://localhost:3003/reset-password?token=${resetToken}`;
    try {
        const html = await renderEmailTemplate("password-reset", {
            name,
            resetUrl,
            expiryTime: "1 hour"
        });
        await transporter.sendMail({
            from: `ashish.j@gradguide.in`,
            to: email,
            subject: "Password Reset Request",
            html,
        });
        return true;
    } catch (error) {
        console.error("Failed to send password reset email:", error);
        throw new Error("Failed to send reset email");
    }
};