import type { BetterAuthClientPlugin } from "better-auth";
import { marsolServerPlugin } from "./marsol";

export const marsolPhoneVerificationClient = ()=>{
    return {
        id: "marsol",
        $InferServerPlugin: {} as ReturnType<typeof marsolServerPlugin>,
    } satisfies BetterAuthClientPlugin
}