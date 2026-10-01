"use client";
import { createContext, useContext, useRef, useState, useEffect, type ReactNode } from "react";
import { Music2, Pause, Play, SkipBack, SkipForward, X, Disc3, GripHorizontal } from "lucide-react";
import { usePathname } from "next/navigation";
type Track = { id: string; title: string; artist: string; playableUrl: string };
type Player = { queue: Track[]; index: number; playing: boolean; error: string; load: (tracks: Track[]) => void; toggle: () => void; next: () => void; previous: () => void };
const Context = createContext<Player | null>(null);
export function MusicProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const load = (tracks: Track[]) => { setQueue(tracks); setIndex(0); setPlaying(false); setError(""); };
  async function toggle() {
    if (!audio.current || !queue.length) return;
    if (playing) audio.current.pause();
    else try { await audio.current.play(); } catch { setError("暂时无法播放，请重试或前往音乐来源页面。"); }
  }
  function skip(delta: number) { audio.current?.pause(); setPlaying(false); setError(""); setIndex(i => (i + delta + queue.length) % queue.length); }
  return <Context.Provider value={{ queue, index, playing, error, load, toggle, next: () => queue.length && skip(1), previous: () => queue.length && skip(-1) }}>
    {children}<audio ref={audio} src={queue[index]?.playableUrl} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setPlaying(false); setError("当前曲目不可播放"); }} onEnded={() => setPlaying(false)} />
    <FloatingPlayer />
  </Context.Provider>;
}
export function MusicCard() {
  const player = useContext(Context)!;
  const track = player.queue[player.index];
  return <section className="panel music-card"><div className="eyebrow"><Music2 size={13} /> MUSIC CORNER</div><div className="music-heading"><div className={`record ${player.playing ? "spinning" : ""}`}><Disc3 size={55} /></div><div><h3>{track?.title ?? "让音乐，慢一点"}</h3><p>{track?.artist ?? "网易云 · 单曲与歌单"}</p></div></div><div className="music-status">{player.error || (track ? "已加入播放队列" : "播放服务接入中，暂不可播放")}</div><div className="player-line" /><div className="player-controls"><button aria-label="上一首" disabled={player.queue.length < 2} onClick={player.previous}><SkipBack size={17}/></button><button className="play" aria-label={player.playing ? "暂停" : "播放"} disabled={!track} onClick={player.toggle}>{player.playing ? <Pause size={19}/> : <Play size={19}/>}</button><button aria-label="下一首" disabled={player.queue.length < 2} onClick={player.next}><SkipForward size={17}/></button></div></section>;
}
function FloatingPlayer() {
  const player = useContext(Context)!;
  const path = usePathname();
  const [hidden, setHidden] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  useEffect(() => { setHidden(false); }, [player.index, player.queue]);
  if (!player.queue.length || path === "/music") return null;
  if (hidden) return <button className="restore-player" onClick={() => setHidden(false)} aria-label="展开播放器"><Music2 size={20}/></button>;
  return <div className="floating-player panel" style={{ left: position.x, top: position.y }}><button className="drag-handle" aria-label="拖动播放器" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, left: position.x, top: position.y }; }} onPointerMove={event => { if (!drag.current) return; setPosition({ x: Math.max(0, Math.min(window.innerWidth - 290, drag.current.left + event.clientX - drag.current.x)), y: Math.max(0, Math.min(window.innerHeight - 100, drag.current.top + event.clientY - drag.current.y)) }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}><GripHorizontal size={18}/></button><span>{player.queue[player.index]?.title}</span><button onClick={player.toggle} aria-label={player.playing ? "暂停" : "播放"}>{player.playing ? <Pause size={16}/> : <Play size={16}/>}</button><button onClick={player.next} disabled={player.queue.length < 2} aria-label="下一首"><SkipForward size={16}/></button><button aria-label="收起播放器" onClick={() => setHidden(true)}><X size={16}/></button></div>;
}
