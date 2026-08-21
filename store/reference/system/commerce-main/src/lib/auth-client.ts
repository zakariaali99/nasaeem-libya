import { adminClient, anonymousClient, phoneNumberClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import { marsolPhoneVerificationClient } from "@/lib/marsol-client"; // Ensure this is imported from your marsol.ts

export const authClient = createAuthClient({
    baseURL: typeof window !== 'undefined' ? window.location.origin : "https://localhost:3000",
    fetchOptions: {
      credentials: "include",
    },
    plugins: [
        phoneNumberClient(),
        anonymousClient(),
        adminClient(),
        marsolPhoneVerificationClient(),
    ],
})