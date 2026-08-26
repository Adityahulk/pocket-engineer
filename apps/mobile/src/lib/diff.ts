export type DiffFile = {
  path: string;
  additions: number;
  deletions: number;
  lines: { type: 'add' | 'del' | 'ctx' | 'meta'; text: string }[];
};

export function parseUnifiedDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      const match = raw.match(/b\/(.+)$/);
      current = { path: match?.[1] ?? 'file', additions: 0, deletions: 0, lines: [] };
      files.push(current);
      continue;
    }
    if (!current) continue;
    if (raw.startsWith('+++') || raw.startsWith('---') || raw.startsWith('index ') || raw.startsWith('new file') || raw.startsWith('deleted file')) {
      current.lines.push({ type: 'meta', text: raw });
      continue;
    }
    if (raw.startsWith('+')) {
      current.additions += 1;
      current.lines.push({ type: 'add', text: raw });
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      current.deletions += 1;
      current.lines.push({ type: 'del', text: raw });
    } else {
      current.lines.push({ type: 'ctx', text: raw });
    }
  }
  return files;
}
