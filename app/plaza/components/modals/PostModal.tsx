"use client";

import { useState } from "react";
import ModalOverlay from "./ModalOverlay";

interface Props {
  onSubmit: (content: string) => Promise<void>;
  onClose: () => void;
}

export default function PostModal({ onSubmit, onClose }: Props) {
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  async function handleSubmit() {
    if (!content.trim()) return;
    setPosting(true);
    try {
      await onSubmit(content);
    } finally {
      setPosting(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="pixel-font mb-3" style={{ fontSize: 14, color: "var(--pixel-text)" }}>发布动态</div>
      <textarea
        className="pixel-textarea mb-3"
        rows={4}
        placeholder="说点什么..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="pixel-btn pixel-btn-accent" onClick={handleSubmit} disabled={posting || !content.trim()}>
          {posting ? "发布中..." : "发布"}
        </button>
        <button className="pixel-btn" onClick={onClose}>取消</button>
      </div>
    </ModalOverlay>
  );
}
