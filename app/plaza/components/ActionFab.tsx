"use client";

import { useState } from "react";

interface Props {
  votingCount: number;
  onPost: () => void;
  onVote: () => void;
}

export default function ActionFab({ votingCount, onPost, onVote }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="action-fab" onClick={() => setOpen(!open)}>
        {open ? "✕" : "＋"}
      </button>
      {open && (
        <div className="action-popup">
          <button className="pixel-btn pixel-btn-accent" onClick={() => { onPost(); setOpen(false); }}>
            📝 发帖
          </button>
          {votingCount > 0 && (
            <button className="pixel-btn" onClick={() => { onVote(); setOpen(false); }}>
              🗳️ 投票 ({votingCount})
            </button>
          )}
        </div>
      )}
    </>
  );
}
