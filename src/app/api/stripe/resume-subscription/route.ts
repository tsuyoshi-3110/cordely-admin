import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { siteKey } = await req.json();
    if (!siteKey) {
      return NextResponse.json({ error: "siteKey required" }, { status: 400 });
    }

    // siteSettings から customerId を取得
    const snap = await adminDb.doc(`siteSettings/${siteKey}`).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "site not found" }, { status: 404 });
    }
    const customerId = snap.data()?.stripeCustomerId as string | undefined;
    if (!customerId) {
      return NextResponse.json({ error: "customer not found" }, { status: 404 });
    }

    // 解約予約（cancel_at_period_end=true）のサブスクを探す
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const pending = subs.data.find(
      (s) =>
        (s.status === "active" || s.status === "trialing") &&
        s.cancel_at_period_end
    );
    if (!pending) {
      return NextResponse.json({ error: "no pending-cancel subscription" }, { status: 404 });
    }

    // 解約予約を解除
    await stripe.subscriptions.update(pending.id, { cancel_at_period_end: false });

    // Firestore 側のフラグも解除
    await adminDb.doc(`siteSettings/${siteKey}`).set(
      { cancelPending: false, subscriptionStatus: "active", updatedAt: new Date() },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("resume-subscription error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
