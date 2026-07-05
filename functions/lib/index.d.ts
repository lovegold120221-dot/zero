/**
 * Proxies /api/* requests to the WhatsApp backend server.
 * This avoids Mixed Content errors when the app is served over HTTPS.
 */
export declare const apiProxy: import("firebase-functions/v2/https").HttpsFunction;
