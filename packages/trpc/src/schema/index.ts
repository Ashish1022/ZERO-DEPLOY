import z from "zod";

const phoneSchema = z
    .string()
    .min(1, "Phone number is required")
    .regex(/^\+[1-9]\d{9,14}$/, "Invalid phone number");

const passwordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number");

export const registerSchema = z.object({
    email: z.string().email(),
    password: passwordSchema,
    firstName: z
        .string()
        .min(1, "First name is required")
        .min(2, "First name must be at least 2 characters")
        .max(100, "First name must be less than 100 characters")
        .regex(/^[a-zA-Z\s'-]+$/, "First name can only contain letters, spaces, hyphens, and apostrophes")
        .trim(),
    lastName: z
        .string()
        .min(1, "Last name is required")
        .min(2, "Last name must be at least 2 characters")
        .max(100, "Last name must be less than 100 characters")
        .regex(/^[a-zA-Z\s'-]+$/, "Last name can only contain letters, spaces, hyphens, and apostrophes")
        .trim(),
    phone: phoneSchema,
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1, "Password is required"),
});

export const otpSchema = z.object({
    otp: z
        .string()
        .min(1, "OTP is required")
        .length(6, "OTP must be exactly 6 digits")
        .regex(/^\d+$/, "OTP must contain only numbers"),
});

export const verifySchema = registerSchema.merge(otpSchema);

export const resetPasswordRequestSchema = z.object({
    email: z.string().email(),
});

export const resetPasswordConfirmSchema = z.object({
    token: z.string().min(1, "Reset token is required"),
    password: passwordSchema,
});

export const resendOtpSchema = z.object({
    email: z.string().email(),
    firstName: z.string().optional(),
});