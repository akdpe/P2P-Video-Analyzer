
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppRole, AnalysisResult, SignalingMessage } from './types';
import { analyzeVideoFrames } from './services/geminiService';
import VideoControls from './components/VideoControls';

const BROADCAST_CHANNEL = 'p2p_signaling_channel';

const App: React.FC = () => {
  const [role, setRole] = useState<AppRole>(AppRole.IDLE);
  const [isLive, setIsLive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const bc = useRef<BroadcastChannel | null>(null);

  // Initialize WebRTC and Signaling
  useEffect(() => {
    bc.current = new BroadcastChannel(BROADCAST_CHANNEL);
    bc.current.onmessage = async (event: MessageEvent<SignalingMessage>) => {
      const msg = event.data;
      if (role === AppRole.IDLE) return;

      try {
        if (msg.type === 'offer' && role === AppRole.PEER) {
          await handleOffer(msg.payload);
        } else if (msg.type === 'answer' && role === AppRole.HOST) {
          await handleAnswer(msg.payload);
        } else if (msg.type === 'candidate' && peerConnection.current) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(msg.payload));
        }
      } catch (err) {
        console.error("Signal Handling Error:", err);
      }
    };

    return () => {
      bc.current?.close();
      cleanup();
    };
  }, [role]);

  const cleanup = () => {
    localStream.current?.getTracks().forEach(t => t.stop());
    peerConnection.current?.close();
    peerConnection.current = null;
    setIsLive(false);
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        bc.current?.postMessage({ type: 'candidate', payload: e.candidate, senderId: role });
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
        setIsLive(true);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setIsLive(true);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') setIsLive(false);
    };

    peerConnection.current = pc;
    return pc;
  };

  const startHost = async () => {
    try {
      setRole(AppRole.HOST);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      bc.current?.postMessage({ type: 'offer', payload: offer, senderId: AppRole.HOST });
      setIsLive(true);
    } catch (err) {
      setError("Camera access failed. Check permissions.");
    }
  };

  const joinPeer = async () => {
    setRole(AppRole.PEER);
    createPeerConnection();
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    const pc = peerConnection.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    bc.current?.postMessage({ type: 'answer', payload: answer, senderId: AppRole.PEER });
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnection.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  };

  const runAnalysis = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);

    const video = role === AppRole.HOST ? localVideoRef.current : remoteVideoRef.current;
    if (!video) return;

    try {
      // Capture 3 frames with 500ms intervals
      const frames: string[] = [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      for (let i = 0; i < 3; i++) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', 0.8));
        await new Promise(r => setTimeout(r, 800));
      }

      const result = await analyzeVideoFrames(frames);
      setHistory(prev => [result, ...prev]);
    } catch (err: any) {
      setError("AI analysis failed. Please ensure your API_KEY is valid and try again.");
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
            P2P VISION ANALYZER
          </h1>
          <p className="text-slate-400 font-medium">Next-gen Video Intelligence powered by Gemini 3 Pro</p>
        </div>

        {role === AppRole.IDLE ? (
          <div className="flex gap-3">
            <button 
              onClick={startHost}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/30"
            >
              Start Streaming
            </button>
            <button 
              onClick={joinPeer}
              className="px-6 py-2.5 glass hover:bg-slate-700/50 rounded-xl font-bold transition-all border-indigo-500/20"
            >
              Join Session
            </button>
          </div>
        ) : (
          <button 
            onClick={() => { cleanup(); setRole(AppRole.IDLE); }}
            className="px-6 py-2.5 glass text-red-400 border-red-500/20 hover:bg-red-500/10 rounded-xl font-bold transition-all"
          >
            End Session
          </button>
        )}
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-400">
          <i className="fas fa-exclamation-triangle"></i>
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Main Viewport */}
        <div className="lg:col-span-8 flex flex-col">
          <div className="relative flex-1 min-h-[400px] glass rounded-t-xl overflow-hidden group">
            <video
              ref={role === AppRole.HOST ? localVideoRef : remoteVideoRef}
              autoPlay
              playsInline
              muted={role === AppRole.HOST}
              className="w-full h-full object-cover"
            />
            {role === AppRole.IDLE && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                <div className="text-center p-8">
                  <i className="fas fa-video-slash text-6xl text-slate-600 mb-4 block"></i>
                  <h2 className="text-xl font-bold text-slate-300">Ready to start?</h2>
                  <p className="text-slate-500">Initialize a Host stream or join as a Peer to begin analyzing.</p>
                </div>
              </div>
            )}
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-xs font-bold border border-white/10 uppercase">
                {role} MODE
              </span>
            </div>
          </div>
          <VideoControls 
            onAnalyze={runAnalysis} 
            isAnalyzing={isAnalyzing} 
            isLive={isLive}
            role={role}
          />
        </div>

        {/* Intelligence Panel */}
        <div className="lg:col-span-4 flex flex-col gap-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          <div className="glass p-5 rounded-2xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <i className="fas fa-microchip text-indigo-400"></i>
              Live Insights
            </h3>
            
            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="py-12 text-center text-slate-500 border-2 border-dashed border-slate-700/50 rounded-xl">
                  <i className="fas fa-dna text-3xl mb-3 opacity-20 block"></i>
                  <p className="text-sm">Capture frames to begin <br/> AI sequence analysis</p>
                </div>
              ) : (
                history.map((item, idx) => (
                  <div key={item.timestamp} className="p-4 bg-slate-800/40 rounded-xl border border-white/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        item.threatLevel === 'High' ? 'bg-red-500 text-white' :
                        item.threatLevel === 'Medium' ? 'bg-yellow-500 text-slate-900' :
                        'bg-emerald-500 text-slate-900'
                      }`}>
                        {item.threatLevel} Alert
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-200 mb-1">{item.summary}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">{item.detailedLog}</p>
                    <div className="flex flex-wrap gap-1">
                      {item.objects.map(obj => (
                        <span key={obj} className="px-2 py-0.5 bg-slate-700/50 text-slate-300 text-[10px] rounded-full border border-slate-600">
                          {obj}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="glass p-5 rounded-2xl flex-1">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <i className="fas fa-network-wired text-cyan-400"></i>
              System Status
            </h3>
            <div className="space-y-3">
              <StatusRow label="Signal Server" value="Local P2P" status="success" />
              <StatusRow label="AI Model" value="Gemini 3 Pro" status="success" />
              <StatusRow label="WebRTC ICE" value={isLive ? 'Active' : 'Standby'} status={isLive ? 'success' : 'idle'} />
              <StatusRow label="Latency" value="~120ms" status="success" />
            </div>
          </div>
        </div>
      </div>

      <footer className="text-center text-slate-500 text-sm pb-4">
        <p>Built with Gemini 3 Pro & WebRTC • Secured P2P Transmission</p>
      </footer>
    </div>
  );
};

interface StatusRowProps {
  label: string;
  value: string;
  status: 'success' | 'warning' | 'idle';
}

const StatusRow: React.FC<StatusRowProps> = ({ label, value, status }) => (
  <div className="flex justify-between items-center text-sm py-2 border-b border-white/5 last:border-0">
    <span className="text-slate-500">{label}</span>
    <div className="flex items-center gap-2">
      <span className="font-semibold text-slate-300">{value}</span>
      <div className={`w-1.5 h-1.5 rounded-full ${
        status === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
        status === 'warning' ? 'bg-amber-500' :
        'bg-slate-600'
      }`} />
    </div>
  </div>
);

export default App;
