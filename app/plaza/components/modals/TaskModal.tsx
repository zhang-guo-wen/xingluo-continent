"use client";

import { useState } from "react";
import ModalOverlay from "./ModalOverlay";

interface Props {
  onSubmit: (data: { title: string; description?: string; reward: number }) => Promise<void>;
  onClose: () => void;
}

export default function TaskModal({ onSubmit, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [reward, setReward] = useState("");

  return (
    <ModalOverlay onClose={onClose}>
      <div className="pixel-font mb-3" style={{ fontSize: 14, color: "var(--pixel-text)" }}>发布任务</div>
      <input className="pixel-input mb-2" placeholder="任务标题" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="pixel-textarea mb-2" rows={3} placeholder="任务描述" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <div className="flex items-center gap-2 mb-3">
        <input
          className="pixel-input"
          type="number"
          placeholder="悬赏金额"
          value={reward}
          onChange={(e) => setReward(e.target.value)}
          style={{ width: "50%" }}
        />
        <span style={{ fontSize: 13, color: "var(--pixel-gold)" }}>XLC（星罗币）</span>
      </div>
      <div className="flex gap-2">
        <button
          className="pixel-btn pixel-btn-accent"
          onClick={() => onSubmit({ title, description: desc || undefined, reward: Number(reward) || 0 })}
          disabled={!title.trim()}
        >
          发布
        </button>
        <button className="pixel-btn" onClick={onClose}>取消</button>
      </div>
    </ModalOverlay>
  );
}
