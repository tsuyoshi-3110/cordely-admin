"use client";

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
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";

export default function SendCredentialsPage() {
  const initialEmail = useAtomValue(credentialsEmailAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  const handleSend = async () => {
    setLoading(true);
    setMessage("");

    try {
      // Firestore から該当ユーザーの customerUrl を取得
      const q = query(
        collection(db, "siteSettings"),
        where("ownerEmail", "==", email)
      );
      const siteSnap = await getDocs(q);

      let customerUrl = "";
      if (!siteSnap.empty) {
        customerUrl = siteSnap.docs[0].data().customerUrl || "";
      }

      console.log("customerUrl", customerUrl);

      // API に送信
      const res = await fetch("/api/send-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, customerUrl }),
      });

      if (res.ok) {
        setMessage("メールを送信しました。");

        // Firestore に送信ログを保存
        await addDoc(collection(db, "credentialsSentLogs"), {
          email,
          sentAt: serverTimestamp(),
        });
      } else {
        setMessage("送信に失敗しました。");
      }
    } catch (error) {
      console.error("送信処理エラー:", error);
      setMessage("エラーが発生しました。");
    }

    setLoading(false);
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
      <Button onClick={handleSend} disabled={loading}>
        {loading ? "送信中..." : "送信する"}
      </Button>
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
