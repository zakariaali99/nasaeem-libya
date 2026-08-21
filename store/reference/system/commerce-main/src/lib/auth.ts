import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db/drizzle"; // your drizzle instance
import * as authSchema from "@/lib/db/auth-schema";
import { admin, phoneNumber } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { marsolServerPlugin } from "@/lib/marsol"; // Ensure this is imported from your marsol.ts


// initialize Better Auth with the adapter
export const auth = betterAuth({
  // IMPORTANT: If the frontend origin (protocol/host/port) is not included here
  // Better Auth will NOT set session cookies. Yesterday it may have worked if
  // you were on https://localhost:3000 but today you're likely accessing the app
  // via http://localhost:3000 (or 127.0.0.1). We include both to avoid mismatch.
  // You can also override via NEXT_PUBLIC_SITE_URL.
  trustedOrigins: [
    // Primary site URL (override in env for staging/prod)
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    // Localhost variants
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'https://127.0.0.1:3000'
  ],
  // Explicitly relax cookie security in dev to avoid Secure= true blocking over http.
  // If Better Auth changes defaults, this guarantees predictable behavior.
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // Cache duration in seconds
    }
  },
  emailAndPassword: {
    enabled: true,
  },
  account: {
    accountLinking: {
      enabled: true,
      allowDifferentEmails: true,
    }
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  plugins: [
    phoneNumber({
      sendForgetPasswordOTP(data, request) {
        console.log("Sending forget password OTP to", data.phoneNumber);
        console.log("OTP:", data.code);
      },
      async sendOTP(data, request) {
        console.log(data.code)
        // await service.sendSms({
        //     phoneNumbers: [data.phoneNumber],
        //     senderId: '9186a3ea-a249-4e5d-9448-91bf3201493a',
        //     message: `رمز التحقق الخاص بك هو ${data.code}`,
        // });
      },
      callbackOnVerification(data, request) {
        if (request?.headers) {
          const userName = request.headers.get('X-USER-NAME');
          if (userName) {
            console.log("User name from header:", userName);
            db.update(authSchema.user).set({
              name: userName,
            }).where(eq(authSchema.user.id, data.user.id));
          }
        }
      },
      signUpOnVerification: {
        getTempEmail(phoneNumber) {
          return 'user' + phoneNumber + '@my-site.com';
        },
      },
    }),
    admin(),
    marsolServerPlugin(), // Ensure this is imported from your marsol.ts
  ],
});