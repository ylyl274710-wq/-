import type { Difficulty } from '../types';

const difficulties: { size: Difficulty; title: string; label: string }[] = [
  { size: 3, title: '轻松一下', label: '9 块' },
  { size: 4, title: '恰好有趣', label: '16 块' },
  { size: 5, title: '认真挑战', label: '25 块' }
];

export default function DifficultySelector({ size, onChange }: { size: Difficulty; onChange: (size: Difficulty) => void }) {
  return <div className="difficulty-options" role="group" aria-label="拼图难度">
    {difficulties.map(item => <button key={item.size} type="button"
      className={`difficulty ${size === item.size ? 'active' : ''}`}
      aria-pressed={size === item.size} onClick={() => onChange(item.size)}>
      <span className="difficulty-top"><strong>{item.size} × {item.size}</strong><span className="radio-dot" /></span>
      <span className="difficulty-bottom">{item.title}<small>{item.label}</small></span>
    </button>)}
  </div>;
}
