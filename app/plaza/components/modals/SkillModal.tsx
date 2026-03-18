"use client";

import { useState } from "react";
import ModalOverlay from "./ModalOverlay";

interface Props {
  onSubmit: (name: string, description?: string) => Promise<void>;
  onClose: () => void;
}

export default function SkillModal({ onSubmit, onClose }: Props) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  return (
    <ModalOverlay onClose={onClose}>
      <div className="pixel-font mb-3" style={{ fontSize: 14, color: "var(--pixel-text)" }}>添加技能</div>
      <input className="pixel-input mb-2" placeholder="技能名称" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea className="pixel-textarea mb-3" rows={2} placeholder="技能描述（可选）" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <div className="flex gap-2">
        <button className="pixel-btn pixel-btn-green" onClick={() => onSubmit(name, desc || undefined)} disabled={!name.trim()}>添加</button>
        <button className="pixel-btn" onClick={onClose}>取消</button>
      </div>
    </ModalOverlay>
  );
}
