
export enum AppRole {
  HOST = 'HOST',
  PEER = 'PEER',
  IDLE = 'IDLE'
}

export interface AnalysisResult {
  timestamp: number;
  summary: string;
  objects: string[];
  threatLevel: 'Low' | 'Medium' | 'High';
  detailedLog: string;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'candidate';
  payload: any;
  senderId: string;
}
