"use client";

import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { credentialsEmailAtom } from "@/lib/atoms/openFlagAtom";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

export default function SendCredentialsPage() {
  const initialEmail = useAtomValue(credentialsEmailAtom);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  const handleSend = async () => {
    setLoading(true);
    setMessage("");

    try {
      // Firestore: ownerEmail からサイト設定を 1 件取得
      const q = query(
        collection(db, "siteSettings"),
        where("ownerEmail", "==", email)
      );
      const snap = await getDocs(q);

      let customerUrl = "";
      let siteKey = "";

      if (!snap.empty) {
        const data = snap.docs[0].data() as {
          customerUrl?: string;
          siteKey?: string;
        };
        customerUrl = data.customerUrl ?? "";
        siteKey = data.siteKey ?? "";
      }

      console.log("customerUrl ->", customerUrl);
      console.log("siteKey     ->", siteKey);

      // API に送信（customerUrl が空でも siteKey があればサーバ側で生成される）
      const res = await fetch("/api/send-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, customerUrl, siteKey }),
      });

      if (res.ok) {
        // 送信ログ
        await addDoc(collection(db, "credentialsSentLogs"), {
          email,
          sentAt: serverTimestamp(),
        });
        setMessage("メールを送信しました。");
      } else {
        const { error } = await res.json().catch(() => ({ error: "" }));
        setMessage(
          `送信に失敗しました。${error ? `(${error})` : ""}`
        );
      }
    } catch (err) {
      console.error("送信処理エラー:", err);
      setMessage("エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 space-y-4">
      <h1 className="text-xl font-bold">ログイン情報を送信</h1>

      <Input
        type="email"
        placeholder="宛先メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <Input
        type="text"
        placeholder="初期パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <Button onClick={handleSend} disabled={loading || !email || !password}>
        {loading ? "送信中..." : "送信する"}
      </Button>

      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
