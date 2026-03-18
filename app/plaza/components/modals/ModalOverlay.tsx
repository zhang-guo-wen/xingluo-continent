"use client";

import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClose: () => void;
}

export default function ModalOverlay({ children, onClose }: Props) {
  return (
    <div className="pixel-modal-overlay" onClick={onClose}>
      <div className="pixel-modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
