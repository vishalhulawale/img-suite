import { Loader2 } from 'lucide-react';

interface ProgressBarProps {
  progress: number;
  status: 'idle' | 'uploading' | 'processing' | 'done' | 'error';
  message?: string;
  processingMessage?: string;
}

export default function ProgressBar({ progress, status, message, processingMessage }: ProgressBarProps) {
  if (status === 'idle') return null;

  const colors = {
    uploading: 'bg-green-500',
    processing: 'bg-amber-500',
    done: 'bg-green-500',
    error: 'bg-red-500',
    idle: 'bg-gray-300',
  };

  return (
    <div className="space-y-2 animate-fade-in">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {(status === 'uploading' || status === 'processing') && (
            <Loader2 className="w-4 h-4 animate-spin text-green-600" />
          )}
          <span className="font-medium text-gray-700">
            {status === 'uploading' && 'Uploading…'}
            {status === 'processing' && (processingMessage || 'Processing image — this may take a moment…')}
            {status === 'done' && '✓ Complete'}
            {status === 'error' && '✕ Error'}
          </span>
        </div>
        {progress > 0 && status !== 'done' && status !== 'error' && (
          <span className="text-gray-500">{progress}%</span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${colors[status]}`}
          style={{ width: `${status === 'done' ? 100 : progress}%` }}
        />
      </div>
      {message && (
        <p className={`text-sm ${status === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
