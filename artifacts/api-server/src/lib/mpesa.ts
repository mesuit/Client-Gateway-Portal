import { logger } from "./logger";
import crypto from "crypto";

const MPESA_BASE_URL = "https://api.safaricom.co.ke";

// ─── DB-backed settings cache ─────────────────────────────────────────────────

interface SettingsCache {
  values: Record<string, string | null>;
  fetchedAt: number;
}

let settingsCache: SettingsCache | null = null;
const SETTINGS_CACHE_TTL = 30_000; // 30 seconds

export function invalidateMpesaSettingsCache(): void {
  settingsCache = null;
  cachedToken = null;
  cachedB2CToken = null;
}

async function getSystemSettings(): Promise<Record<string, string | null>> {
  if (settingsCache && Date.now() - settingsCache.fetchedAt < SETTINGS_CACHE_TTL) {
    return settingsCache.values;
  }
  try {
    const { db } = await import("@workspace/db");
    const { systemSettingsTable } = await import("@workspace/db");
    const rows = await db.select().from(systemSettingsTable);
    const values: Record<string, string | null> = {};
    for (const row of rows) {
      values[row.key] = row.value;
    }
    settingsCache = { values, fetchedAt: Date.now() };
    return values;
  } catch {
    return {};
  }
}

async function getSetting(key: string, envKey?: string): Promise<string> {
  const settings = await getSystemSettings();
  const dbVal = settings[key];
  if (dbVal && dbVal.trim()) return dbVal.trim();
  const resolvedEnvKey = envKey ?? key.toUpperCase().replace(/-/g, "_");
  return process.env[resolvedEnvKey] ?? "";
}

// ─── STK Push (C2B) ──────────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const consumerKey = await getSetting("mpesa_consumer_key", "MPESA_CONSUMER_KEY");
  const consumerSecret = await getSetting("mpesa_consumer_secret", "MPESA_CONSUMER_SECRET");

  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const response = await fetch(
    `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, "Failed to get M-Pesa access token");
    throw new Error(`Failed to get M-Pesa access token: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: string };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (parseInt(data.expires_in) - 60) * 1000,
  };
  return cachedToken.token;
}

export function getTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${y}${mo}${d}${h}${mi}${s}`;
}

export async function getPassword(timestamp: string): Promise<string> {
  const shortcode = await getSetting("mpesa_shortcode", "MPESA_SHORTCODE");
  const passkey = await getSetting("mpesa_passkey", "MPESA_PASSKEY");
  const raw = `${shortcode}${passkey}${timestamp}`;
  return Buffer.from(raw).toString("base64");
}

export function getCallbackBaseUrl(req?: { protocol: string; get(h: string): string | undefined }): string {
  if (process.env.CALLBACK_BASE_URL) return process.env.CALLBACK_BASE_URL.replace(/\/$/, "");
  const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (replitDomain) return `https://${replitDomain}`;
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  if (devDomain) return `https://${devDomain}`;
  if (req) return `${req.protocol}://${req.get("host")}`;
  return "https://pay.makamesco-tech.co.ke";
}

export interface STKPushParams {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  callbackUrl: string;
  merchantTill?: string;
  merchantPaybill?: string;
}

export interface STKPushResult {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export async function initiateSTKPush(params: STKPushParams): Promise<STKPushResult> {
  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = await getPassword(timestamp);
  const shortcode = await getSetting("mpesa_shortcode", "MPESA_SHORTCODE");

  const phone = params.phoneNumber.replace(/^\+/, "").replace(/^0/, "254");

  let partyB: string;
  let transactionType: string;
  if (params.merchantTill) {
    partyB = params.merchantTill;
    transactionType = "CustomerBuyGoodsOnline";
  } else if (params.merchantPaybill) {
    partyB = params.merchantPaybill;
    transactionType = "CustomerPayBillOnline";
  } else {
    partyB = shortcode;
    transactionType = "CustomerPayBillOnline";
  }

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: transactionType,
    Amount: Math.ceil(params.amount),
    PartyA: phone,
    PartyB: partyB,
    PhoneNumber: phone,
    CallBackURL: params.callbackUrl,
    AccountReference: params.accountReference,
    TransactionDesc: params.transactionDesc,
  };

  logger.info({ partyB, transactionType, phone, amount: params.amount }, "Initiating STK Push");

  const response = await fetch(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, "STK Push request failed");
    throw new Error(`STK Push failed: ${response.status} ${text}`);
  }

  return (await response.json()) as STKPushResult;
}

// ─── B2C ─────────────────────────────────────────────────────────────────────

let cachedB2CToken: { token: string; expiresAt: number } | null = null;

async function getB2CAccessToken(): Promise<string> {
  if (cachedB2CToken && Date.now() < cachedB2CToken.expiresAt) {
    return cachedB2CToken.token;
  }
  const consumerKey = await getSetting("b2c_consumer_key", "B2C_CONSUMER_KEY") ||
    await getSetting("mpesa_consumer_key", "MPESA_CONSUMER_KEY");
  const consumerSecret = await getSetting("b2c_consumer_secret", "B2C_CONSUMER_SECRET") ||
    await getSetting("mpesa_consumer_secret", "MPESA_CONSUMER_SECRET");

  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const response = await fetch(
    `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` } }
  );
  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, "Failed to get B2C access token");
    throw new Error(`Failed to get B2C access token: ${response.status}`);
  }
  const data = (await response.json()) as { access_token: string; expires_in: string };
  cachedB2CToken = {
    token: data.access_token,
    expiresAt: Date.now() + (parseInt(data.expires_in) - 60) * 1000,
  };
  return cachedB2CToken.token;
}

const SAFARICOM_PRODUCTION_CERT = `-----BEGIN CERTIFICATE-----
MIIGkzCCBHugAwIBAgIKXfBp5gAAAAAnBDANBgkqhkiG9w0BAQsFADBiMQswCQYD
VQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEe
MBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMQwwCgYDVQQLEwNBT0MwHhcN
MTYwNTI2MTMyOTU2WhcNMTgwNTI2MTMzOTU2WjCBiDELMAkGA1UEBhMCS0UxEDAO
BgNVBAgTB05haXJvYmkxEDAO BgNVBAcTB05haXJvYmkxGDAWBgNVBAoTD1NhZmFy
aWNvbSBMaW1pdGVkMRIwEAYDVQQLEwlEYXJhamEgQVBJMSUwIwYDVQQDExxhcGku
c2FmYXJpY29tLmNvLmtlL21wZXNhQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAw
ggEKAoIBAQC5p5reS6fWGaFnTFVjJJSMgD3tFz0rIxPZBCNMECBqFQeYHmFwvBMl
JePJnEYFpEGJQTMUBhgCPVnDlwPILVqXVW9bUJTqmkGqBY5EEhP3k1TZVxp3blkl
Y93BL/WdFB2EX0O4GjBDQ+BZvDIaHa+MSHoJAhK3kXL+NqrP3sGxsLhFvDK1jY5N
cLfxO8jI+Kk3FHEdYBJE9VXHAB96aD0OtZxrXN1ECwGmMFEjm2P6o8A/PkCYNLb8
iDWMR6hFBpQRSEMwHVxfQbHb7vDfhHGMr0KqX5c6V0SvhV4E+xvYcVVo4mH1j2nM
MjHqCY9aTJFOANQvSflJcEhvMBIRAgMBAAGjggIoMIICJDAdBgNVHQ4EFgQUmhkU
2wRiNWuuHGOWLlFCbRN0Oc4wHwYDVR0jBBgwFoAUwFfHhMqGfQYK2A8QJT1FKAG
DvCIwggEEBgNVHSAEgfswgfgwgfUGCysGAQQBsjEBAgIGMIHlMGUGCCsGAQUFBwIB
Flladw1zYWZhcmljb20uY28ua2UvaW1hZ2VzL0Rvd25sb2Fkcy9EYXJhamFfQVBJ
X1Rlcm1zX0NvbmRpdGlvbnMucGRmMDwGCCsGAQUFBwICMDAeLh5UaGlzIGNlcnRp
ZmljYXRlIGlzIGZvciBEYXJhamEgQVBJIHVzZSBvbmx5LjAOBgNVHQ8BAf8EBAMC
BaAwEwYDVR0lBAwwCgYIKwYBBQUHAwEwDAYDVR0TAQH/BAIwADCBqQYDVR0fBIGh
MIGeMIGboIGYoIGVhoGSbGRhcDovLy9DTj1TYWZhcmljb20lMjBBenVyZSUyMFRT
dWIlMjBDQSxDTj1hcGlzYWZhcmljb20tY28ta2UtbXBlc2FjYSxDTj1DRFAsMz1Q
dWJsaWMlMjBLZXklMjBTZXJ2aWNlcyxDTj1TZXJ2aWNlcyxDTj1Db25maWd1cmF0
aW9uLERDPXNhZmFyaWNvbSxEQz1jbyxEQz1rZTA4BggrBgEFBQcBAQQsMCowKAYI
KwYBBQUHMAKGHGxkYXA6Ly8vQ049YXBpc2FmYXJpY29tLmNlcjANBgkqhkiG9w0B
AQsFAAOCAgEAFpB4PCYi5wJPaQPLTU16hWpX0gSb4LrKnUejPxpA3fWEaTCOb1BI
j7wqx0sNBCqn02BKAbzz0A+/0GuSi/M7oTCGqDJUHoP7A0Rp8JZ3vPi9z0mlHYBF
VGXHNDWvKG0LZPz0X6vQk5z0SxzN6IaW5CW7lNvkK3mZ9LkI8+A/qZ8gMJ2UZST
dXs0T+kM3j1kxSdFMEnN0dVZHkP4J0rkCk1wPYlN5mAhKYn1VCxqZ3q89M/kNHNM
jWuKJiL1Q5BnA8v1VlTzSR+TmS6pS8bJ5qdD0iFKXzCvJ5D0bBbL6N3w4bHAbOgd
uZ7J8xW0q9kgJXHZQGcDw+dVUf1qG+yMSPqzV8cD7k5b1n+K5/z0i3jyM8O5pLrz
cS3E/4j3N6kqRJv9XS5OFbfVa7wU1yD/sj7Lh5E6kqRCGnlm6T7WEfj7T8d5K1JG
9X0yQf4C8NrY1V7iRPb1sT8Fk9/ZqO3+M4I7kO/jWl4r6U5YVF3oCpsBf1E0KZ0
G7y8pP5qV3j8sX7K2MYm0nPJHo7RrEFz3/S5pHiVBkrCcR4m2G1V9y/0L+Z4T3H
c7K5zQHX0O4GjBDQ+BZvDIaHa+MSHoJAhK3kXL+NqrP3sGxsLhFvDK1jY5Ncvf
xO8jI+Kk3FHEdYBJE9VXHAB96aD0OtZxrXN1ECwGmMFEjm2P6o8A/PkCYNLb8Xc=
-----END CERTIFICATE-----`;

export async function getSecurityCredential(): Promise<string> {
  const direct = await getSetting("mpesa_security_credential", "MPESA_SECURITY_CREDENTIAL");
  if (direct) return direct;

  const initiatorPassword = await getSetting("mpesa_initiator_password", "MPESA_INITIATOR_PASSWORD");
  if (!initiatorPassword) {
    throw new Error("mpesa_security_credential or mpesa_initiator_password must be configured for B2C");
  }

  try {
    const publicKey = crypto.createPublicKey(SAFARICOM_PRODUCTION_CERT);
    const encrypted = crypto.publicEncrypt(
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(initiatorPassword)
    );
    return encrypted.toString("base64");
  } catch {
    throw new Error(
      "Failed to encrypt B2C security credential. Set mpesa_security_credential directly in System Settings."
    );
  }
}

export type B2CCommandId = "BusinessPayment" | "SalaryPayment" | "PromotionPayment";

export interface B2CParams {
  phoneNumber: string;
  amount: number;
  commandId?: B2CCommandId;
  remarks: string;
  occasion?: string;
  resultUrl: string;
  timeoutUrl: string;
}

export interface B2CResult {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

export async function initiateB2C(params: B2CParams): Promise<B2CResult> {
  const initiatorName = await getSetting("mpesa_initiator_name", "MPESA_INITIATOR_NAME");
  if (!initiatorName) throw new Error("mpesa_initiator_name must be configured for B2C");

  const b2cShortcode = await getSetting("b2c_shortcode", "B2C_SHORTCODE") ||
    await getSetting("mpesa_shortcode", "MPESA_SHORTCODE");

  const token = await getB2CAccessToken();
  const securityCredential = await getSecurityCredential();

  const phone = params.phoneNumber.replace(/^\+/, "").replace(/^0/, "254");

  const body = {
    InitiatorName: initiatorName,
    SecurityCredential: securityCredential,
    CommandID: params.commandId ?? "BusinessPayment",
    Amount: Math.ceil(params.amount),
    PartyA: b2cShortcode,
    PartyB: phone,
    Remarks: params.remarks,
    QueueTimeOutURL: params.timeoutUrl,
    ResultURL: params.resultUrl,
    Occasion: params.occasion ?? "",
  };

  logger.info({ phone, amount: params.amount, commandId: body.CommandID }, "Initiating B2C payment");

  const response = await fetch(`${MPESA_BASE_URL}/mpesa/b2c/v1/paymentrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, "B2C request failed");
    throw new Error(`B2C failed: ${response.status} ${text}`);
  }

  return (await response.json()) as B2CResult;
}
