'use client';

import type { ReactNode } from 'react';

/**
 * Lightweight markdown renderer — no external library.
 * Handles: headings (# ## ###), **bold**, *italic*, `code`,
 * --- (hr), unordered lists (- / *), ordered lists (1. 2.),
 * tables (| col | col |), and plain paragraphs.
 */

function inlineRender(text: string): ReactNode[] {
  // Split on bold/italic/code tokens
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="italic text-slate-200">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-slate-800/80 text-emerald-300 font-mono text-[10px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const nodes: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} className="border-slate-700/60 my-2" />);
      i++;
      continue;
    }

    // Headings
    const h3 = line.match(/^###\s+(.+)/);
    if (h3) {
      nodes.push(<p key={i} className="text-[11px] font-bold text-slate-100 mt-3 mb-0.5">{inlineRender(h3[1]!)}</p>);
      i++;
      continue;
    }
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      nodes.push(<p key={i} className="text-[12px] font-bold text-white mt-3 mb-0.5">{inlineRender(h2[1]!)}</p>);
      i++;
      continue;
    }
    const h1 = line.match(/^#\s+(.+)/);
    if (h1) {
      nodes.push(<p key={i} className="text-[13px] font-bold text-white mt-3 mb-0.5">{inlineRender(h1[1]!)}</p>);
      i++;
      continue;
    }

    // Unordered list block
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^[-*]\s+/, ''));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-0.5 my-1 pl-2">
          {items.map((item, j) => (
            <li key={j} className="text-slate-300">{inlineRender(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list block
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\d+\.\s+/, ''));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside space-y-0.5 my-1 pl-2">
          {items.map((item, j) => (
            <li key={j} className="text-slate-300">{inlineRender(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Table: line begins with |
    if (line.trimStart().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]!.trimStart().startsWith('|')) {
        tableLines.push(lines[i]!);
        i++;
      }
      // skip separator row (e.g. |---|---|)
      const dataRows = tableLines.filter((r) => !/^\|[-| :]+\|$/.test(r.trim()));
      const parseRow = (r: string) =>
        r.split('|').map((c) => c.trim()).filter((_, ci, arr) => ci > 0 && ci < arr.length - 1);

      if (dataRows.length > 0) {
        const header = parseRow(dataRows[0]!);
        const body = dataRows.slice(1);
        nodes.push(
          <div key={`tbl-${i}`} className="overflow-x-auto my-1.5">
            <table className="text-[10px] border-collapse w-full">
              <thead>
                <tr>
                  {header.map((col, ci) => (
                    <th key={ci} className="border border-slate-700 px-2 py-0.5 text-left text-slate-300 bg-slate-800/60 font-semibold whitespace-nowrap">
                      {inlineRender(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) =>
                  parseRow(row).length > 0 ? (
                    <tr key={ri} className="even:bg-slate-800/20">
                      {parseRow(row).map((cell, ci) => (
                        <td key={ci} className="border border-slate-700/60 px-2 py-0.5 text-slate-400">
                          {inlineRender(cell)}
                        </td>
                      ))}
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    }

    // Empty line → spacing
    if (line.trim() === '') {
      nodes.push(<div key={i} className="h-1" />);
      i++;
      continue;
    }

    // Plain paragraph
    nodes.push(
      <p key={i} className="text-slate-300 leading-relaxed">{inlineRender(line)}</p>,
    );
    i++;
  }

  return <div className="space-y-0.5 text-[12px]">{nodes}</div>;
}
