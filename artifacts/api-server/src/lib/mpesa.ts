import { logger } from "./logger";
import crypto from "crypto";

const MPESA_BASE_URL = "https://api.safaricom.co.ke";
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY!;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET!;
const PASSKEY = process.env.MPESA_PASSKEY!;
const SHORTCODE = process.env.MPESA_SHORTCODE!;

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");
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

export function getPassword(timestamp: string): string {
  const raw = `${SHORTCODE}${PASSKEY}${timestamp}`;
  return Buffer.from(raw).toString("base64");
}

export function getCallbackBaseUrl(req?: { protocol: string; get(h: string): string | undefined }): string {
  // 1. Explicit override via env var (set this on VPS)
  if (process.env.CALLBACK_BASE_URL) return process.env.CALLBACK_BASE_URL.replace(/\/$/, "");
  // 2. Replit prod domain
  const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (replitDomain) return `https://${replitDomain}`;
  // 3. Replit dev domain
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  if (devDomain) return `https://${devDomain}`;
  // 4. Derive from request
  if (req) return `${req.protocol}://${req.get("host")}`;
  return "https://pay.makamesco-tech.co.ke";
}

export interface STKPushParams {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  callbackUrl: string;
  /**
   * Merchant's M-Pesa till number registered under the platform head-office shortcode.
   * When set → CustomerBuyGoodsOnline, PartyB = till number.
   */
  merchantTill?: string;
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
  const password = getPassword(timestamp);

  const phone = params.phoneNumber.replace(/^\+/, "").replace(/^0/, "254");

  // Route to merchant's till (BuyGoods) or platform shortcode (PayBill / paybill sub-account).
  // NOTE: CustomerPayBillOnline requires BusinessShortCode == PartyB, so we can only push
  // to the platform's own shortcode.  Paybill settlement uses AccountReference (sub-account)
  // to identify the merchant; till uses CustomerBuyGoodsOnline where PartyB = till number.
  let partyB: string;
  let transactionType: string;
  if (params.merchantTill) {
    partyB = params.merchantTill;
    transactionType = "CustomerBuyGoodsOnline";
  } else {
    partyB = SHORTCODE;
    transactionType = "CustomerPayBillOnline";
  }

  const body = {
    BusinessShortCode: SHORTCODE,
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

// Safaricom Production Certificate (for encrypting the initiator password).
// This is Safaricom's publicly published ProductionCertificate.cer in PEM form.
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

export function getSecurityCredential(): string {
  // Option 1: pre-computed credential set directly as env var (recommended for production)
  if (process.env.MPESA_SECURITY_CREDENTIAL) {
    return process.env.MPESA_SECURITY_CREDENTIAL;
  }

  // Option 2: compute from initiator password + Safaricom production cert
  const initiatorPassword = process.env.MPESA_INITIATOR_PASSWORD;
  if (!initiatorPassword) {
    throw new Error("MPESA_SECURITY_CREDENTIAL or MPESA_INITIATOR_PASSWORD must be set for B2C");
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
      "Failed to encrypt B2C security credential. Set MPESA_SECURITY_CREDENTIAL directly in your .env file."
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
  const initiatorName = process.env.MPESA_INITIATOR_NAME;
  if (!initiatorName) throw new Error("MPESA_INITIATOR_NAME must be set for B2C");

  const token = await getAccessToken();
  const securityCredential = getSecurityCredential();

  const phone = params.phoneNumber.replace(/^\+/, "").replace(/^0/, "254");

  const body = {
    InitiatorName: initiatorName,
    SecurityCredential: securityCredential,
    CommandID: params.commandId ?? "BusinessPayment",
    Amount: Math.ceil(params.amount),
    PartyA: SHORTCODE,
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
