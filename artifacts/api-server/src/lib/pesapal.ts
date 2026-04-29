import { logger } from "./logger";

const PESAPAL_BASE = "https://pay.pesapal.com/v3";
const CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY!;
const CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET!;

export const PLATFORM_FEE_PERCENT = 10;

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getPesapalToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const res = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ consumer_key: CONSUMER_KEY, consumer_secret: CONSUMER_SECRET }),
  });

  if (!res.ok) {
    const txt = await res.text();
    logger.error({ status: res.status, body: txt }, "PesaPal auth failed");
    throw new Error(`PesaPal auth failed: ${res.status}`);
  }

  const data = (await res.json()) as { token: string; expiresDate: string };
  const expiresAt = new Date(data.expiresDate).getTime() - 60_000;
  cachedToken = { token: data.token, expiresAt };
  return data.token;
}

export async function registerIPN(ipnUrl: string): Promise<string> {
  const token = await getPesapalToken();
  const res = await fetch(`${PESAPAL_BASE}/api/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ url: ipnUrl, ipn_notification_type: "GET" }),
  });

  if (!res.ok) {
    const txt = await res.text();
    logger.error({ status: res.status, body: txt }, "PesaPal IPN registration failed");
    throw new Error(`IPN registration failed: ${res.status}`);
  }

  const data = (await res.json()) as { ipn_id: string };
  return data.ipn_id;
}

let cachedIpnId: string | null = null;

export async function getOrRegisterIPN(ipnUrl: string): Promise<string> {
  if (cachedIpnId) return cachedIpnId;
  cachedIpnId = await registerIPN(ipnUrl);
  return cachedIpnId;
}

export interface SubmitOrderParams {
  merchantRef: string;
  amount: number;
  currency?: string;
  description: string;
  callbackUrl: string;
  cancellationUrl: string;
  ipnId: string;
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface SubmitOrderResult {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
}

export async function submitOrder(params: SubmitOrderParams): Promise<SubmitOrderResult> {
  const token = await getPesapalToken();

  const body = {
    id: params.merchantRef,
    currency: params.currency ?? "KES",
    amount: params.amount,
    description: params.description,
    callback_url: params.callbackUrl,
    cancellation_url: params.cancellationUrl,
    notification_id: params.ipnId,
    billing_address: {
      phone_number: params.phone ?? "",
      email_address: params.email ?? "",
      first_name: params.firstName ?? "Customer",
      last_name: params.lastName ?? "",
    },
  };

  logger.info({ merchantRef: params.merchantRef, amount: params.amount }, "PesaPal submit order");

  const res = await fetch(`${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    logger.error({ status: res.status, body: txt }, "PesaPal submit order failed");
    throw new Error(`PesaPal order failed: ${res.status} ${txt}`);
  }

  return (await res.json()) as SubmitOrderResult;
}

export interface TransactionStatusResult {
  payment_method: string;
  amount: number;
  created_date: string;
  confirmation_code: string;
  payment_status_description: string;
  description: string;
  message: string;
  merchant_reference: string;
  currency: string;
  order_tracking_id: string;
  status_code: number;
  payment_account: string;
  call_back_url: string;
  error: { error_type: string | null; code: string | null; message: string | null };
  status: string;
}

export async function getTransactionStatus(orderTrackingId: string): Promise<TransactionStatusResult> {
  const token = await getPesapalToken();
  const res = await fetch(
    `${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PesaPal status check failed: ${res.status} ${txt}`);
  }

  return (await res.json()) as TransactionStatusResult;
}

export function calculateFees(grossAmount: number): { netAmount: number; platformFee: number } {
  const platformFee = Math.round(grossAmount * PLATFORM_FEE_PERCENT) / 100;
  const netAmount = Math.round((grossAmount - platformFee) * 100) / 100;
  return { netAmount, platformFee };
}
