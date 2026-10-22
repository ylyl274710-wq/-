import { useEffect, useState } from 'react';

export function tutorialFinished(): boolean { try { return localStorage.getItem('puzzle-tutorial-finished') === 'yes'; } catch { return false; } }
export default function TutorialCoach({ selected, placed, preview, onClose }: { selected: number | null; placed: number; preview: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  function finish() { try { localStorage.setItem('puzzle-tutorial-finished', 'yes'); } catch { /* 本次仍可关闭指引。 */ } onClose(); }
  useEffect(() => { if (selected !== null) setStep(previous => Math.max(previous, 1)); }, [selected]);
  useEffect(() => { if (placed > 0) setStep(2); }, [placed]);
  useEffect(() => { if (preview) finish(); }, [preview]);
  const steps = ['先从纸片盒选一片。选中后，画布角落会显示放大预览。', '拖到画布上寻找位置。暂时没对齐也能留下，邻接切口对上会连成一组。', '按住底部的预览看原图；工具里还有位置提示、放回一片和撤销重切。'];
  return <aside className="tutorial-coach" aria-label="新手三步指引"><button className="coach-close" aria-label="关闭新手指引" onClick={finish}>×</button><strong>第一次见面 · {step + 1}/3</strong><p>{steps[step]}</p><button className="text-button" onClick={() => step === 2 ? finish() : setStep(step + 1)}>{step === 2 ? '知道了，开始享受拼图' : '下一步 →'}</button></aside>;
}
