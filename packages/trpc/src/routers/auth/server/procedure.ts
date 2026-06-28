import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, and, isNull } from 'drizzle-orm';
import { headers as getHeaders } from 'next/headers';

import { baseProcedure, createTRPCRouter } from '../../../init';
import { loginSchema, registerSchema, verifySchema } from '../../../schema'

import { TRPCError } from '@trpc/server';
import { users } from '@zero-deploy/database/schema';
import { generateAuthCookie } from "@zero-deploy/auth-backend/cookie"
import { checkOtpRestrictions, trackOtpRequests, verifyOtp, sendEmail, sendOtp, sendPasswordResetEmail } from "@zero-deploy/auth-backend/utils"

export const authRouter = createTRPCRouter({
    session: baseProcedure.query(({ ctx }) => {
        return {
            user: ctx.user,
            isAuthenticated: !!ctx.user,
        }
    }),

    login: baseProcedure
        .input(loginSchema)
        .mutation(async ({ ctx, input }) => {
            const existingUser = await ctx.db
                .select()
                .from(users)
                .where(eq(users.email, input.email))
                .limit(1);

            if (existingUser.length === 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Email does not exist!"
                });
            }

            const user = existingUser[0];

            if (!user.emailVerified) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Please verify your account before logging in."
                });
            }

            if (user.lockUntil && user.lockUntil > new Date()) {
                const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000));
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: `Account is temporarily locked. Please try again in ${minutesLeft} minutes.`
                });
            }

            const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);

            if (!isValidPassword) {
                const newAttempts = (user.loginAttempts || 0) + 1;
                const lockUntil = newAttempts >= 5
                    ? new Date(Date.now() + 15 * 60 * 1000)
                    : null;

                await ctx.db
                    .update(users)
                    .set({
                        loginAttempts: newAttempts,
                        lockUntil: lockUntil,
                        updatedAt: new Date()
                    })
                    .where(eq(users.id, user.id));

                const attemptsLeft = 5 - newAttempts;
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: newAttempts >= 5
                        ? "Account locked due to too many failed attempts."
                        : `Invalid credentials! ${attemptsLeft} attempts remaining.`
                });
            }

            await ctx.db
                .update(users)
                .set({
                    loginAttempts: 0,
                    lockUntil: null,
                    lastLoginAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(users.id, user.id));

            const token = jwt.sign(
                { userId: user.id, email: user.email },
                process.env.JWT_SECRET!,
                { expiresIn: '7d' }
            );

            await generateAuthCookie({
                prefix: "zero-deploy-access-token",
                value: token,
            });

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    firstname: user.firstName,
                    lastname: user.lastName,
                },
                token
            };
        }),

    register: baseProcedure
        .input(registerSchema)
        .mutation(async ({ ctx, input }) => {
            const existingUser = await ctx.db
                .select()
                .from(users)
                .where(and(
                    eq(users.email, input.email),
                    isNull(users.deletedAt)
                ))
                .limit(1);

            if (existingUser.length > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Email is already registered."
                });
            }

            try {
                await checkOtpRestrictions(input.email);
                await trackOtpRequests(input.email);
                await sendOtp(input.firstName, input.email);
            } catch (error) {
                throw new TRPCError({
                    code: "TOO_MANY_REQUESTS",
                    message: error instanceof Error ? error.message : "Failed to send OTP"
                });
            }

            return { message: "OTP sent to your email. Please verify your account." };
        }),

    verify: baseProcedure
        .input(verifySchema)
        .mutation(async ({ ctx, input }) => {
            try {
                await verifyOtp(input.email, input.otp);
            } catch (error) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: error instanceof Error ? error.message : "Invalid OTP or OTP expired"
                });
            }

            const hashedPassword = await bcrypt.hash(input.password, 12);

            const newUser = await ctx.db
                .insert(users)
                .values({
                    email: input.email,
                    firstName: input.firstName,
                    lastName: input.lastName,
                    phone: input.phone,
                    passwordHash: hashedPassword,
                    emailVerified: true,
                    loginAttempts: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                })
                .returning({
                    id: users.id,
                    email: users.email,
                    firstName: users.firstName,
                    lastName: users.lastName,
                });

            const token = jwt.sign(
                { userId: newUser[0].id, email: newUser[0].email },
                process.env.JWT_SECRET!,
                { expiresIn: '7d' }
            );

            await generateAuthCookie({
                value: token,
                prefix: "zero-deploy-access-token"
            });

            return { user: newUser[0], token };
        }),

    logout: baseProcedure
        .mutation(async () => {
            await generateAuthCookie({
                prefix: "zero-deploy-access-token",
                value: "",
            });

            return { success: true, message: "Logged out successfully" };
        }),

    requestPasswordReset: baseProcedure
        .input(z.object({
            email: z.string().email()
        }))
        .mutation(async ({ ctx, input }) => {
            const [user] = await ctx.db
                .select()
                .from(users)
                .where(
                    and(
                        eq(users.email, input.email.toLowerCase()),
                        eq(users.emailVerified, true),
                        isNull(users.deletedAt)
                    )
                )
                .limit(1);

            if (!user) {
                return { success: true };
            }

            const resetToken = crypto.randomBytes(32).toString('hex');
            const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
            const resetExpiration = new Date(Date.now() + 60 * 60 * 1000);

            await ctx.db
                .update(users)
                .set({
                    resetPasswordToken: hashedToken,
                    resetPasswordExpiration: resetExpiration,
                    updatedAt: new Date()
                })
                .where(eq(users.id, user.id));

            await sendPasswordResetEmail({
                name: user.firstName,
                email: user.email,
                resetToken,
            });

            return { success: true };
        }),

    verifyResetToken: baseProcedure
        .input(z.object({
            token: z.string()
        }))
        .query(async ({ ctx, input }) => {
            const hashedToken = crypto.createHash('sha256').update(input.token).digest('hex');

            const [user] = await ctx.db
                .select({
                    id: users.id,
                    email: users.email,
                    firstName: users.firstName,
                    resetPasswordExpiration: users.resetPasswordExpiration,
                })
                .from(users)
                .where(
                    and(
                        eq(users.resetPasswordToken, hashedToken),
                        isNull(users.deletedAt)
                    )
                )
                .limit(1);

            if (!user || !user.resetPasswordExpiration) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Invalid or expired reset token",
                });
            }

            if (user.resetPasswordExpiration < new Date()) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Reset token has expired",
                });
            }

            return {
                valid: true,
                email: user.email,
                firstName: user.firstName,
            };
        }),

    resetPassword: baseProcedure
        .input(z.object({
            token: z.string(),
            password: z.string().min(8)
        }))
        .mutation(async ({ ctx, input }) => {
            const hashedToken = crypto.createHash('sha256').update(input.token).digest('hex');

            const [user] = await ctx.db
                .select()
                .from(users)
                .where(
                    and(
                        eq(users.resetPasswordToken, hashedToken),
                        isNull(users.deletedAt)
                    )
                )
                .limit(1);

            if (!user || !user.resetPasswordExpiration) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Invalid or expired reset token"
                });
            }

            if (user.resetPasswordExpiration < new Date()) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Reset token has expired"
                });
            }

            const hashedPassword = await bcrypt.hash(input.password, 12);

            await ctx.db
                .update(users)
                .set({
                    passwordHash: hashedPassword,
                    resetPasswordToken: null,
                    resetPasswordExpiration: null,
                    loginAttempts: 0,
                    lockUntil: null,
                    updatedAt: new Date()
                })
                .where(eq(users.id, user.id));

            return { success: true, message: "Password reset successfully" };
        }),

    changePassword: baseProcedure
        .input(z.object({
            currentPassword: z.string(),
            newPassword: z.string().min(8)
        }))
        .mutation(async ({ ctx, input }) => {
            const headers = await getHeaders();
            const cookieHeader = headers.get('cookie');

            if (!cookieHeader) {
                throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
            }

            const tokenMatch = cookieHeader.match(/zero-deploy-access-token=([^;]+)/);
            if (!tokenMatch) {
                throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
            }

            const decoded = jwt.verify(tokenMatch[1], process.env.JWT_SECRET!) as { userId: string };

            const existingUser = await ctx.db
                .select()
                .from(users)
                .where(and(eq(users.id, decoded.userId), isNull(users.deletedAt)))
                .limit(1);

            if (existingUser.length === 0) {
                throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
            }

            const user = existingUser[0];
            const isValidPassword = await bcrypt.compare(input.currentPassword, user.passwordHash);

            if (!isValidPassword) {
                throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
            }

            const hashedPassword = await bcrypt.hash(input.newPassword, 12);

            await ctx.db
                .update(users)
                .set({ passwordHash: hashedPassword, updatedAt: new Date() })
                .where(eq(users.id, user.id));

            return { message: "Password changed successfully" };
        }),

    updateProfile: baseProcedure
        .input(z.object({
            firstName: z.string().min(1).optional(),
            lastName: z.string().min(1).optional()
        }))
        .mutation(async ({ ctx, input }) => {
            const headers = await getHeaders();
            const cookieHeader = headers.get('cookie');

            if (!cookieHeader) {
                throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
            }

            const tokenMatch = cookieHeader.match(/zero-deploy-access-token=([^;]+)/);
            if (!tokenMatch) {
                throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
            }

            const decoded = jwt.verify(tokenMatch[1], process.env.JWT_SECRET!) as { userId: string };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updateData: any = { updatedAt: new Date() };
            if (input.firstName) updateData.firstName = input.firstName;
            if (input.lastName) updateData.lastName = input.lastName;

            const updatedUser = await ctx.db
                .update(users)
                .set(updateData)
                .where(and(eq(users.id, decoded.userId), isNull(users.deletedAt)))
                .returning({
                    id: users.id,
                    email: users.email,
                    firstName: users.firstName,
                    lastName: users.lastName,
                });

            if (updatedUser.length === 0) {
                throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
            }

            return { user: updatedUser[0], message: "Profile updated successfully" };
        }),

    resendOtp: baseProcedure
        .input(z.object({
            email: z.string().email(),
            firstName: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            try {
                await checkOtpRestrictions(input.email);
                await trackOtpRequests(input.email);
                await sendOtp(input.firstName ?? "User", input.email);
            } catch (error) {
                throw new TRPCError({
                    code: "TOO_MANY_REQUESTS",
                    message: error instanceof Error ? error.message : "Failed to send OTP"
                });
            }

            return { message: "OTP sent to your email successfully" };
        }),

    deleteAccount: baseProcedure
        .input(z.object({
            password: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            const headers = await getHeaders();
            const cookieHeader = headers.get('cookie');

            if (!cookieHeader) {
                throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
            }

            const tokenMatch = cookieHeader.match(/zero-deploy-access-token=([^;]+)/);
            if (!tokenMatch) {
                throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
            }

            const decoded = jwt.verify(tokenMatch[1], process.env.JWT_SECRET!) as { userId: string };

            const existingUser = await ctx.db
                .select()
                .from(users)
                .where(and(eq(users.id, decoded.userId), isNull(users.deletedAt)))
                .limit(1);

            if (existingUser.length === 0) {
                throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
            }

            const user = existingUser[0];
            const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);

            if (!isValidPassword) {
                throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid password" });
            }

            await ctx.db
                .update(users)
                .set({ deletedAt: new Date(), updatedAt: new Date() })
                .where(eq(users.id, user.id));

            await generateAuthCookie({
                prefix: "zero-deploy-access-token",
                value: "",
            });

            return { message: "Account deleted successfully" };
        }),
});