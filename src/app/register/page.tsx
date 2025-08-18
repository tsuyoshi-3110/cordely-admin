// app/register/page.tsx（例）
// 修正された RegisterPage：Stripe 連携 + customerUrl を siteSettings に保存
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { handleSearchAddress } from "@/lib/addressUtil";
import { createSiteSettings } from "@/lib/createSiteSettings";
import { auth, db } from "@/lib/firebase";
import { FirebaseError } from "firebase/app";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore"; // ← setDoc 追加
import { AsYouType, parsePhoneNumberFromString } from "libphonenumber-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import validator from "validator";

const CUSTOMER_ORIGIN = "https://cordely-customers.vercel.app";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [siteKey, setSiteKey] = useState("");
  const [siteName, setSiteName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerAddress, setOwnerAddress] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFreePlan, setIsFreePlan] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.push("/login");
    });
    return () => unsubscribe();
  }, [router]);

  const handleRegister = async () => {
    setLoading(true);
    try {
      // siteKey の重複チェック
      const ref = doc(db, "siteSettings", siteKey);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const confirmOverwrite = window.confirm(
          "この siteKey はすでに使われています。上書きしてもよろしいですか？"
        );
        if (!confirmOverwrite) {
          alert("登録をキャンセルしました。");
          return;
        }
      }

      // Firebase Auth ユーザー作成（サーバー側。自動ログイン防止）
      const userRes = await fetch("/api/create-firebase-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!userRes.ok) {
        const { error } = await userRes.json();

        if (error === "email-already-in-use") {
          alert("このメールアドレスはすでに登録されています。");
          return;
        }
        if (error === "invalid-password") {
          alert("パスワードは6文字以上で入力してください。");
          return;
        }
        throw new Error("Firebaseアカウントの作成に失敗しました");
      }

      const { uid } = await userRes.json();

      // Stripe 顧客/サブスク（有料プランのみ）
      let customerId: string | null = null;
      let subscriptionId: string | null = null;

      if (!isFreePlan) {
        const stripeRes = await fetch("/api/stripe/create-stripe-customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            name: ownerName,
            metadata: {
              siteKey,
              siteName,
              ownerPhone,
            },
          }),
        });

        if (!stripeRes.ok) {
          throw new Error("Stripeの登録に失敗しました");
        }

        const json = await stripeRes.json();
        customerId = json.customerId;
        subscriptionId = json.subscriptionId;
      }

      // 顧客向けURLを siteKey から生成
      const customerUrl = `${CUSTOMER_ORIGIN}/?siteKey=${encodeURIComponent(
        siteKey
      )}`;

      // Firestore へ siteSettings 保存（createSiteSettings 経由）
      await createSiteSettings(siteKey, {
        ownerId: uid,
        siteName,
        siteKey,
        ownerName,
        ownerAddress,
        ownerEmail: email,
        ownerPhone,
        isFreePlan,
        ...(customerId && { stripeCustomerId: customerId }),
        ...(subscriptionId && { stripeSubscriptionId: subscriptionId }),
        setupMode: false,
      });

      // 念のため merge で customerUrl を確実に残す
      await setDoc(
        doc(db, "siteSettings", siteKey),
        { customerUrl },
        { merge: true }
      );

      alert("登録が完了しました！");
      setEmail("");
      setPassword("");
      setSiteKey("");
      setSiteName("");
      setOwnerName("");
      setOwnerAddress("");
      setOwnerPhone("");
      setIsFreePlan(false);
    } catch (e) {
      if (e instanceof FirebaseError) {
        alert(
          e.code === "auth/email-already-in-use"
            ? "このメールアドレスはすでに登録されています。"
            : "登録時にエラーが発生しました: " + e.message
        );
      } else {
        alert("不明なエラーが発生しました。");
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] gap-6 p-8">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="freePlan"
          checked={isFreePlan}
          onChange={(e) => setIsFreePlan(e.target.checked)}
        />
        <label htmlFor="freePlan">無料プランにする（Stripe連携しない）</label>
      </div>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle>アカウント登録</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {email && (
            <p
              className={`text-sm ${
                validator.isEmail(email) ? "text-green-600" : "text-red-600"
              }`}
            >
              {validator.isEmail(email)
                ? "✅ 有効なメールアドレス形式です"
                : "⚠️ メールアドレスの形式が不正です"}
            </p>
          )}

          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="パスワード（6文字以上）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={() => setPassword(Math.random().toString(36).slice(-10))}
            >
              自動生成
            </Button>
          </div>

          <Input
            type="text"
            placeholder="siteKey（英数字）"
            value={siteKey}
            onChange={(e) => setSiteKey(e.target.value)}
          />
          {siteKey && (
            <p
              className={`text-sm ${
                /^[a-zA-Z0-9]+$/.test(siteKey)
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {/^[a-zA-Z0-9]+$/.test(siteKey)
                ? "✅ 半角英数字の形式です"
                : "⚠️ siteKeyは半角英数字のみで入力してください"}
            </p>
          )}

          <Input
            type="text"
            placeholder="サイト名"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
          />

          <Input
            type="text"
            placeholder="名前（オーナー）"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />

          <Input
            type="text"
            placeholder="郵便番号（例: 123-4567）"
            maxLength={8}
            value={postalCode}
            onChange={(e) => {
              let input = e.target.value.replace(/[^\d]/g, ""); // 数字以外を除去
              if (input.length > 3) {
                input = `${input.slice(0, 3)}-${input.slice(3, 7)}`;
              }
              setPostalCode(input);
            }}
            onBlur={() => {
              const formattedZipCode = postalCode.replace("-", "");
              (async () => {
                await handleSearchAddress(
                  formattedZipCode,
                  setOwnerAddress,
                  setIsSearchingAddress
                );
              })();
            }}
          />
          {isSearchingAddress && (
            <p className="text-sm text-gray-500">住所を検索中...</p>
          )}

          <Input
            type="text"
            placeholder="住所"
            value={ownerAddress}
            onChange={(e) => setOwnerAddress(e.target.value)}
          />

          <div className="space-y-1">
            <Input
              type="tel"
              placeholder="電話番号（例: 09012345678）"
              value={ownerPhone}
              onChange={(e) => {
                const input = e.target.value;
                const formatted = new AsYouType("JP").input(input);
                setOwnerPhone(formatted);
              }}
            />
            {ownerPhone && (
              <p className="text-sm text-gray-500">
                {parsePhoneNumberFromString(ownerPhone, "JP")?.isValid()
                  ? "✅ 有効な電話番号です"
                  : "⚠️ 無効な形式の電話番号です"}
              </p>
            )}
          </div>

          <Button
            onClick={handleRegister}
            disabled={loading}
            className="w-full"
          >
            {loading ? "登録中..." : "登録する"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
