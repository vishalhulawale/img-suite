interface ImagePreviewProps {
  src: string;
  alt?: string;
  label?: string;
}

export default function ImagePreview({ src, alt = 'Preview', label }: ImagePreviewProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden animate-fade-in">
      {label && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <p className="text-xs font-medium text-gray-500">{label}</p>
        </div>
      )}
      <div className="p-4 flex items-center justify-center">
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-80 object-contain rounded-lg"
          style={{ background: 'repeating-conic-gradient(#f3f4f6 0% 25%, transparent 0% 50%) 50% / 16px 16px' }}
        />
      </div>
    </div>
  );
}
