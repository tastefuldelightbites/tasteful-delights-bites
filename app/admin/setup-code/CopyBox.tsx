'use client';
import { useRef, useState } from 'react';

export function CopyBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      ref.current?.select();
      document.execCommand('copy');
    }
    setCopied(true);
  };
  return (
    <div className="stack">
      <button className="btn btn-block" onClick={copy}>{copied ? '✓ Copied! Now paste it in Supabase' : 'Copy Setup Code'}</button>
      <textarea ref={ref} className="textarea" readOnly value={text} style={{ minHeight: 260, fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
    </div>
  );
}
