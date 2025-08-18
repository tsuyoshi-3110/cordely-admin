"use client";

import { openFlagAtom } from "@/lib/atoms/openFlagAtom";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useAtom } from "jotai";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFlag, setOpenFlag] = useAtom(openFlagAtom);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    const savedFlag = localStorage.getItem("cordely_open_flag");
    if (savedFlag !== null) setOpenFlag(JSON.parse(savedFlag));
  }, [setOpenFlag]);

  const toggleMenu = useCallback(() => setMenuOpen((p) => !p), []);

  // 画面スクロールをロック（開いている間だけ）
  useEffect(() => {
    if (menuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Escapeで閉じる
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <>
      {/* ナビバー */}
      <nav className="fixed top-0 left-0 z-50 flex h-16 w-full items-center justify-between bg-white px-4 py-4 shadow-md md:px-6">
        <Link
          href="/"
          className="text-lg font-bold text-gray-700 hover:text-blue-500"
        >
          Cordely管理サイト
        </Link>
        <button
          className="text-gray-700"
          onClick={toggleMenu}
          aria-label="メニューを開く"
          aria-expanded={menuOpen}
          aria-controls="navbar-drawer"
        >
          <Menu className="h-6 w-6" />
        </button>
      </nav>

      {/* オーバーレイ（かなり薄く／ブラーで暗転感を抑える） */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        } bg-black/10 backdrop-blur-[2px]`}
        onClick={toggleMenu}
      />

      {/* ドロワー */}
      <aside
        id="navbar-drawer"
        role="dialog"
        aria-modal="true"
        className={`fixed top-0 right-0 z-50 h-full w-64 transform bg-white shadow-lg transition-transform duration-300 ease-in-out ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b px-4 py-4">
          <span className="text-lg font-bold">メニュー</span>
          <button onClick={toggleMenu} aria-label="メニューを閉じる">
            <X className="h-6 w-6 text-gray-700" />
          </button>
        </div>

        <div className="flex flex-col space-y-3 px-4 py-2">
          {openFlag && (
            <>
              <Link
                href="/login"
                onClick={toggleMenu}
                className="text-gray-700 hover:text-blue-500"
              >
                ログイン
              </Link>
              {user && (
                <>
                  <Link
                    href="/register"
                    onClick={toggleMenu}
                    className="text-gray-700 hover:text-blue-500"
                  >
                    アカウント作成
                  </Link>
                  <Link
                    href="/sites"
                    onClick={toggleMenu}
                    className="text-gray-700 hover:text-blue-500"
                  >
                    サイト一覧
                  </Link>
                  <Link
                    href="/send-transfer"
                    onClick={toggleMenu}
                    className="text-gray-700 hover:text-blue-500"
                  >
                    請求メール
                  </Link>
                  <Link
                    href="/send-credentials"
                    onClick={toggleMenu}
                    className="text-gray-700 hover:text-blue-500"
                  >
                    アカウントメール
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
