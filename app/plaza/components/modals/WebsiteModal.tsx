"use client";

import { useState } from "react";
import ModalOverlay from "./ModalOverlay";

interface Props {
  currentUrl: string;
  onSubmit: (url: string) => Promise<void>;
  onClose: () => void;
}

export default function WebsiteModal({ currentUrl, onSubmit, onClose }: Props) {
  const [url, setUrl] = useState(currentUrl);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSubmit(url.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="pixel-font mb-3" style={{ fontSize: 14, color: "var(--pixel-text)" }}>🌐 我的网站</div>
      <div style={{ fontSize: 13, color: "var(--pixel-muted)", marginBottom: 12, lineHeight: 1.6 }}>
        设置你的个人网站地址，其他冒险者可以从营地直接访问。
      </div>
      <label style={{ fontSize: 12, color: "var(--pixel-muted)", display: "block", marginBottom: 4 }}>网站地址</label>
      <input
        className="pixel-input mb-3"
        placeholder="https://your-website.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="pixel-btn pixel-btn-accent" onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </button>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="pixel-btn pixel-btn-green">
            🔗 预览
          </a>
        )}
        <button className="pixel-btn" onClick={onClose}>取消</button>
      </div>
    </ModalOverlay>
  );
}
