// app/api/send-credentials/route.ts
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_REDIRECT_URI,
  GOOGLE_SENDER_EMAIL,
  // 任意: フォールバック用の基底URL（無ければ既定値）
  NEXT_PUBLIC_CUSTOMERS_BASE_URL,
  NEXT_PUBLIC_OWNERS_BASE_URL,
} = process.env;

const CUSTOMERS_BASE_URL =
  NEXT_PUBLIC_CUSTOMERS_BASE_URL || "https://cordely-customers.vercel.app";
const OWNERS_BASE_URL =
  NEXT_PUBLIC_OWNERS_BASE_URL || "https://cordely-owners.vercel.app";

export async function POST(req: NextRequest) {
  const {
    email,
    password,
    customerUrl: bodyCustomerUrl,
    siteKey,
  } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // 受け取った customerUrl を最優先で使用。無ければ siteKey から生成、さらに無ければベースURL。
  const customerUrl =
    (bodyCustomerUrl && String(bodyCustomerUrl).trim()) ||
    (siteKey
      ? `${CUSTOMERS_BASE_URL}?siteKey=${encodeURIComponent(siteKey)}`
      : CUSTOMERS_BASE_URL);

  console.log("customerUrl", customerUrl);

  const ownersUrl = OWNERS_BASE_URL; // 固定でOK

  // QRコードを生成（customerUrl をそのまま）
  const qrDataUrl = await QRCode.toDataURL(customerUrl, { width: 240 });
  const qrBase64 = qrDataUrl.split(",")[1]; // "data:image/png;base64,..." から Base64 部分だけ抽出

  // 件名(MIME Base64)
  const subject = "ログイン情報のご案内";
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString(
    "base64"
  )}?=`;

  // マルチパート(MIME)を自前生成（本文 + 画像添付）
  const boundary = "mail-boundary-" + Date.now();

  const textBody = [
    "以下のログイン情報をご利用ください。",
    "",
    `顧客用URL: ${customerUrl}`, // ← siteKey 付きがそのまま入る
    `店舗用URL: ${ownersUrl}`,
    "",
    `メールアドレス: ${email}`,
    `初回ログインパスワード: ${password}`,
    "",
    "※顧客用URLのQRコードを添付しています。店頭掲示などにお使いください。",
  ].join("\n");

  // multipart/mixed
  const mime = [
    `From: Xenovant <${GOOGLE_SENDER_EMAIL}>`,
    `To: ${email}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    "",
    textBody,
    "",
    `--${boundary}`,
    `Content-Type: image/png`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="customer-qr.png"`,
    "",
    qrBase64,
    "",
    `--${boundary}--`,
  ].join("\r\n");

  // Gmail 送信
  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  oAuth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  const raw = Buffer.from(mime)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Gmail送信エラー:", err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
