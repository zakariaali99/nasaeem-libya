import { BetterAuthPlugin, User } from "better-auth";
import { setSessionCookie } from "better-auth/cookies";
import { createAuthEndpoint } from "better-auth/api";
import { APIError } from "better-auth/api";

import { z } from "zod";

const PHONE_NUMBER = "0920010991"
const VERIFICATION = "111111"

export const marsolServerPlugin = () => {
    return {
        // Unified plugin ID for client and server
        id: "marsol",
        endpoints: {
            initiatePhoneVerification: createAuthEndpoint("/marsol/initiate-phone-verification", {
                method: "POST",
                body: z.object({
                    phoneNumber: z.string(),
                    clientOs: z.string().optional(),
                    language: z.string().optional(),
                    operation: z.string().optional(),
                    authType: z.string().optional(),
                }),
            }, async (ctx) => {
                const { phoneNumber, operation, authType } = ctx.body;

                // Validate authType logic before sending OTP
                if (authType === 'login' || authType === 'register') {
                    const user = await ctx.context.adapter.findOne({
                        model: "user",
                        where: [{ field: "phoneNumber", value: phoneNumber }],
                    });

                    if (authType === 'login' && !user) {
                        throw new APIError("NOT_FOUND", { message: "User not found" });
                    }
                    if (authType === 'register' && user) {
                        throw new APIError("BAD_REQUEST", { message: "Phone number already exists" });
                    }
                }

                if (phoneNumber === PHONE_NUMBER) {
                    // Return mock response for test phone number without API call
                    return ctx.json({
                        success: true,
                        requestId: 'test-request-id',
                        resendToken: 'test-resend-token',
                        status: 'PENDING'
                    }, { status: 201 });
                }
                const apiToken = process.env.MARSOL_API_TOKEN!;
                try {
                    const response = await fetch('https://api.marsol.ly/public/otp/initiate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-auth-token': apiToken,
                        },
                        body: JSON.stringify({ phoneNumber: ctx.body.phoneNumber, length: 6, expiration: 300, clientOs: ctx.body.clientOs, language: ctx.body.language, operation: ctx.body.operation, senderId: process.env.MARSOL_SENDER_ID }),
                    });
                    const data = await response.json();
                    if (!response.ok && !data.success) {
                        console.error('Error initiating 2FA:', data);
                        return ctx.json({ success: false, error: data }, { status: response.status });
                    }
                    return ctx.json({ success: true, ...data }, { status: 201 });
                } catch (error) {
                    console.error('Error initiating 2FA:', error);
                    return ctx.json({ success: false, error: 'Failed to initiate verification' }, { status: 500 });
                }
            }),
            verifyPhoneNumberRequest: createAuthEndpoint("/marsol/verify-phone-number-request", {
                method: "POST",
                body: z.object({
                    code: z.string(),
                    requestId: z.string(),
                    operation: z.string().optional(),
                    authType: z.string().optional(),
                    name: z.string().optional(),
                }),
            }, async (ctx) => {
                const { code, requestId, operation, authType, name } = ctx.body;

                let phoneNumber: string | undefined;

                // Handle test case without API call - check for test requestId and code
                if (requestId === 'test-request-id' && code === VERIFICATION) {
                    console.log('Processing test verification for phone:', PHONE_NUMBER);
                    phoneNumber = PHONE_NUMBER;
                } else {
                    const apiToken = process.env.MARSOL_API_TOKEN!;
                    try {
                        const response = await fetch('https://api.marsol.ly/public/otp/verify', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-auth-token': apiToken,
                            },
                            body: JSON.stringify({ code, requestId, operation }),
                        });

                        const verificationResult = await response.json();
                        if (!response.ok || verificationResult.status !== 'SUCCESS') {
                            console.error('OTP verification failed:', verificationResult);
                            return ctx.json({ success: false, error: verificationResult }, { status: response.status });
                        }
                        phoneNumber = verificationResult.recipient ?? PHONE_NUMBER;
                    } catch (error) {
                        console.error('Error verifying OTP:', error);
                        return ctx.json({ success: false, error: 'Verification error' }, { status: 500 });
                    }
                }

                if (!phoneNumber) {
                    return ctx.json({ success: false, error: 'Phone number not found' }, { status: 400 });
                }

                try {
                    type UserWithPhoneNumber = User & {
                        phoneNumber: string;
                        phoneNumberVerified: boolean;
                        role?: string;
                        banned?: boolean;
                        banReason?: string | null;
                        banExpires?: Date | null;
                    };

                    let user = await ctx.context.adapter.findOne<UserWithPhoneNumber>({
                        model: "user",
                        where: [
                            {
                                field: "phoneNumber",
                                value: phoneNumber,
                            },
                        ],
                    });

                    if (!user) {
                        if (authType === 'login') {
                            throw new APIError("NOT_FOUND", { message: "User not found" });
                        }
                        const now = new Date();
                        user = await ctx.context.internalAdapter.createUser<UserWithPhoneNumber>({
                            name: name ?? `user${phoneNumber}`,
                            email: `user${phoneNumber}@my-site.com`,
                            emailVerified: false,
                            image: null,
                            createdAt: now,
                            updatedAt: now,
                            phoneNumber,
                            phoneNumberVerified: true,
                            role: 'user',
                            banned: false,
                            banReason: null,
                            banExpires: null,
                        });
                        console.log('Created new user:', user?.id);
                    } else {
                        console.log('Using existing user with ID:', user.id);
                        if (!user.phoneNumberVerified) {
                            user = await ctx.context.internalAdapter.updateUser(user.id, {
                                phoneNumberVerified: true
                            });
                        }
                    }

                    if (!user) {
                        return ctx.json({ success: false, error: 'Failed to find or create user' }, { status: 500 });
                    }

                    const session = await ctx.context.internalAdapter.createSession(user.id, ctx.request, false, undefined, ctx);
                    await setSessionCookie(ctx, { session, user });
                    return ctx.json({ token: session.token, user: user });
                } catch (error) {
                    console.error('Error in user/session handling:', error);
                    return ctx.json({ success: false, error: 'Authentication error' }, { status: 500 });
                }
            }),
            retry: createAuthEndpoint("/marsol/retry-verification", {
                method: "POST",
                body: z.object({
                    requestId: z.string(),
                    resendToken: z.string(),
                    operation: z.string().optional(),
                }),
            }, async (ctx) => {
                const { requestId, resendToken, operation = 'CODE' } = ctx.body;
                const apiToken = process.env.MARSOL_API_TOKEN!;
                try {
                    const response = await fetch('https://api.marsol.ly/public/otp/resend', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-auth-token': apiToken,
                        },
                        body: JSON.stringify({ requestId, resendToken, operation }),
                    });
                    const data = await response.json();
                    if (!response.ok) {
                        console.error('Error resending OTP:', data);
                        return ctx.json({ success: false, error: data }, { status: response.status });
                    }
                    return ctx.json({ success: true, ...data }, { status: 201 });
                } catch (error) {
                    console.error('Error resending OTP:', error);
                    return ctx.json({ success: false, error: 'Failed to resend OTP' }, { status: 500 });
                }
            })
        }
    } satisfies BetterAuthPlugin
}

