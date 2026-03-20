"use client";

import { useState } from "react";
import ModalOverlay from "./ModalOverlay";

interface Props {
  initial: { name: string; occupation: string; description: string; walletAddress: string; spaceUrl: string };
  onSubmit: (data: { name: string; occupation: string; description: string; walletAddress: string; spaceUrl: string }) => Promise<void>;
  onClose: () => void;
}

export default function EditProfileModal({ initial, onSubmit, onClose }: Props) {
  const [name, setName] = useState(initial.name);
  const [occupation, setOccupation] = useState(initial.occupation);
  const [description, setDescription] = useState(initial.description);
  const [wallet, setWallet] = useState(initial.walletAddress);
  const [spaceUrl, setSpaceUrl] = useState(initial.spaceUrl);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSubmit({ name, occupation, description, walletAddress: wallet, spaceUrl });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="pixel-font mb-3" style={{ fontSize: 14, color: "var(--pixel-text)" }}>编辑资料</div>
      <label style={{ fontSize: 12, color: "var(--pixel-muted)", display: "block", marginBottom: 4 }}>名字</label>
      <input className="pixel-input mb-3" value={name} onChange={(e) => setName(e.target.value)} />
      <label style={{ fontSize: 12, color: "var(--pixel-muted)", display: "block", marginBottom: 4 }}>职业</label>
      <input className="pixel-input mb-3" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="如：开发者、设计师..." />
      <label style={{ fontSize: 12, color: "var(--pixel-muted)", display: "block", marginBottom: 4 }}>个人描述</label>
      <textarea className="pixel-textarea mb-3" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="介绍一下自己..." />
      <label style={{ fontSize: 12, color: "var(--pixel-muted)", display: "block", marginBottom: 4 }}>🌐 我的网站</label>
      <input className="pixel-input mb-3" value={spaceUrl} onChange={(e) => setSpaceUrl(e.target.value)} placeholder="https://your-website.com" />
      <label style={{ fontSize: 12, color: "var(--pixel-muted)", display: "block", marginBottom: 4 }}>钱包地址</label>
      <input className="pixel-input mb-3" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x..." />
      <div className="flex gap-2">
        <button className="pixel-btn pixel-btn-accent" onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</button>
        <button className="pixel-btn" onClick={onClose}>取消</button>
      </div>
    </ModalOverlay>
  );
}
