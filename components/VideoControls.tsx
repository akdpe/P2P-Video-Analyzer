
import React from 'react';

interface VideoControlsProps {
  onAnalyze: () => void;
  isAnalyzing: boolean;
  isLive: boolean;
  role: string;
}

const VideoControls: React.FC<VideoControlsProps> = ({ onAnalyze, isAnalyzing, isLive, role }) => {
  return (
    <div className="flex items-center justify-between p-4 glass rounded-b-xl border-t-0">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
        <span className="text-sm font-medium uppercase tracking-wider text-slate-400">
          {isLive ? 'Live Stream' : 'Connection Idle'}
        </span>
        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs rounded border border-indigo-500/30 uppercase font-bold">
          {role}
        </span>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing || !isLive}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
            isAnalyzing || !isLive 
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-95'
          }`}
        >
          {isAnalyzing ? (
            <>
              <i className="fas fa-circle-notch fa-spin"></i>
              Analyzing...
            </>
          ) : (
            <>
              <i className="fas fa-brain"></i>
              AI Scan
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default VideoControls;
