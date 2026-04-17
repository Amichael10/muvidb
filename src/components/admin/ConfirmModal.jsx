export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', confirmColor = 'bg-red-500 hover:bg-red-600', onConfirm, onCancel, isProcessing = false }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={!isProcessing ? onCancel : undefined}
      />
      
      {/* Modal */}
      <div className="relative bg-[#13192B] rounded-2xl shadow-2xl border border-border w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
        <h3 className="text-xl font-semibold text-text-primary mb-2">
          {title}
        </h3>
        <p className="text-text-muted mb-8">
          {message}
        </p>
        
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-sm font-medium text-text-primary bg-surface hover:bg-surface-2 transition-colors border border-border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmColor}`}
          >
            {isProcessing ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
