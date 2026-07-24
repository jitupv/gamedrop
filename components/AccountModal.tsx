"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faEnvelope, faUserAstronaut, faXmark } from "@fortawesome/free-solid-svg-icons";
import {
  AccountInfo,
  attachEmail,
  getAccount,
  leaderboardEnabled,
  myHandle,
  renameHandle,
  signOutAccount,
} from "@/lib/sdk/leaderboard";

// Optional account - play stays free and guest-first forever. An email just
// makes your name and scores follow you across devices (and unlocks future
// Vault perks when those arrive).
export default function AccountModal({ onClose }: { onClose: () => void }) {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [name, setName] = useState("");
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const online = leaderboardEnabled();

  useEffect(() => {
    setName(myHandle());
    getAccount().then(setAccount);
  }, []);

  const saveName = async () => {
    setBusy(true);
    const r = await renameHandle(name);
    setNameMsg({ ok: r.ok, text: r.message });
    if (r.ok) setName(name.trim());
    setBusy(false);
  };

  const sendLink = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailMsg({ ok: false, text: "That doesn't look like an email address." });
      return;
    }
    setBusy(true);
    const r = await attachEmail(email.trim());
    setEmailMsg({ ok: r.ok, text: r.message });
    setBusy(false);
  };

  const signOut = async () => {
    setBusy(true);
    await signOutAccount();
    setAccount(await getAccount());
    setBusy(false);
  };

  return createPortal(
    <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="panel max-w-sm w-full max-h-full overflow-y-auto">
        <button className="panel-x" aria-label="Close" onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} width={12} height={12} />
        </button>

        <h2 className="text-2xl font-extrabold tracking-tight tx-ink text-center mb-1">
          <FontAwesomeIcon icon={faUserAstronaut} width={20} height={20} /> Your player card
        </h2>
        <p className="text-center text-sm tx-muted mb-5">
          No account needed to play - this is all optional.
        </p>

        <p className="overline mb-2">Name on the leaderboards</p>
        <div className="acct-row">
          <input
            className="acct-input"
            value={name}
            maxLength={24}
            onChange={(e) => {
              setName(e.target.value);
              setNameMsg(null);
            }}
            aria-label="Display name"
          />
          <button className="btn-ink px-4 py-2 text-sm" onClick={saveName} disabled={busy}>
            Save
          </button>
        </div>
        {nameMsg && (
          <p className={`acct-msg${nameMsg.ok ? " ok" : ""}`}>
            {nameMsg.ok && <FontAwesomeIcon icon={faCircleCheck} width={11} height={11} />}{" "}
            {nameMsg.text}
          </p>
        )}

        <div className="border-t mt-5 pt-4" style={{ borderColor: "var(--line)" }}>
          {account?.email ? (
            <>
              <p className="overline mb-2">Account</p>
              <p className="text-sm tx-ink font-semibold">{account.email}</p>
              <p className="text-xs tx-muted mt-1 mb-3">
                Your name and scores follow this email on any device.
              </p>
              <button className="btn-line px-4 py-2 text-sm" onClick={signOut} disabled={busy}>
                Sign out on this device
              </button>
            </>
          ) : (
            <>
              <p className="overline mb-2">Keep your progress (optional)</p>
              <p className="text-xs tx-muted mb-3">
                You&apos;re playing as a guest on this device. Add your email and your name,
                scores and streaks follow you to any phone or laptop - plus early access to
                what&apos;s coming for Vault members.
              </p>
              {online ? (
                <>
                  <div className="acct-row">
                    <input
                      className="acct-input"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailMsg(null);
                      }}
                      aria-label="Email address"
                    />
                    <button className="btn-ink px-4 py-2 text-sm whitespace-nowrap" onClick={sendLink} disabled={busy}>
                      <FontAwesomeIcon icon={faEnvelope} width={12} height={12} /> Link
                    </button>
                  </div>
                  {emailMsg && (
                    <p className={`acct-msg${emailMsg.ok ? " ok" : ""}`}>
                      {emailMsg.ok && <FontAwesomeIcon icon={faCircleCheck} width={11} height={11} />}{" "}
                      {emailMsg.text}
                    </p>
                  )}
                  <p className="text-xs tx-soft mt-3">
                    No password, no spam - one click on the link we email you and you&apos;re set.
                  </p>
                </>
              ) : (
                <p className="acct-msg">Accounts come online with the leaderboard - soon.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
