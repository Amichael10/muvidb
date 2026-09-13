import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReviews } from '../../hooks/useReviews'
import { Icon } from '@iconify/react'

const StarRating = ({ value, onChange, readonly = false }) => {
    const [hover, setHover] = useState(0)

    return (
        <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <button
                    key={num}
                    type="button"
                    disabled={readonly}
                    onClick={() => !readonly && onChange?.(num)}
                    onMouseEnter={() => !readonly && setHover(num)}
                    onMouseLeave={() => !readonly && setHover(0)}
                    className={`transition-all duration-200 ${num <= (hover || value)
                            ? 'text-brand scale-110'
                            : 'text-surface-3'
                        } ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-125'}`}
                >
                    <Icon icon={num <= (hover || value) ? "solar:star-bold" : "solar:star-linear"} className="text-xl" />
                </button>
            ))}
            <span className="text-xs font-black text-brand ml-3 bg-brand/5 px-2 py-0.5 rounded-xl border border-brand/10">
                {value > 0 ? `${value}/10` : 'SCORE'}
            </span>
        </div>
    )
}

const ReviewCard = ({
    review,
    currentUser,
    onEdit,
    onDelete,
    onOpenOverlay
}) => {
    const [timeRemaining, setTimeRemaining] = useState(null);
    const [expanded, setExpanded] = useState(false);
    
    // Check if the review is still editable (within 5 minutes of creation).
    const getEditStatus = () => {
        const createdTime = new Date(review.created_at).getTime();
        const now = Date.now();
        const diffMs = now - createdTime;
        const diffMinutes = diffMs / 1000 / 60;
        const remainingSeconds = Math.max(0, 300 - Math.floor(diffMs / 1000));
        return { isEditable: diffMinutes < 5, remainingSeconds };
    };

    useEffect(() => {
        const { isEditable } = getEditStatus();
        if (isEditable && currentUser?.id === review.user_id) {
            const timer = setInterval(() => {
                const { isEditable: stillEditable, remainingSeconds } = getEditStatus();
                setTimeRemaining(remainingSeconds);
                if (!stillEditable) clearInterval(timer);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [review.created_at, currentUser?.id]);

    const userName = review.users?.name || 'Anonymous';
    const avatarUrl = review.users?.avatar_url || null;
    const initials = userName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    
    const isOwner = currentUser?.id === review.user_id;
    const { isEditable } = getEditStatus();
    const isLongText = (review.body || '').length > 180;

    return (
        <div className="bg-surface border border-border rounded-xl p-5 transition-all duration-300 hover:shadow-md hover:border-brand/30 group relative flex flex-col justify-between h-full">
            <div>
                <div className="flex items-start justify-between relative z-10 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-surface-2 group-hover:border-brand/30 transition-all shadow-sm" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-brand/5 border-2 border-brand/10 flex items-center justify-center text-brand font-black text-xs">
                                    {initials}
                                </div>
                            )}
                            {isOwner && isEditable && (
                                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-brand rounded-full border-2 border-surface flex items-center justify-center animate-pulse">
                                    <Icon icon="solar:info-circle-bold" className="text-[8px] text-white" />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-text-primary font-bold text-sm tracking-tight truncate">{userName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-text-muted text-[10px] font-black uppercase tracking-widest">
                                    {new Date(review.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                                {isOwner && isEditable && timeRemaining > 0 && (
                                    <span className="text-brand text-[8px] font-bold bg-brand/5 px-1.5 py-0.5 rounded italic">
                                        {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <div className="text-brand font-black text-base tracking-tighter flex items-center gap-1 bg-brand/5 border border-brand/15 px-2 py-0.5 rounded-lg">
                            <Icon icon="solar:star-bold" className="text-xs" />
                            {review.rating}<span className="text-[10px] text-text-muted">/10</span>
                        </div>
                        {isOwner && isEditable && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => onEdit(review)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-surface-2 text-text-secondary hover:bg-brand hover:text-white transition-all shadow-sm"
                                    title="Edit"
                                >
                                    <Icon icon="solar:pen-linear" width="12" />
                                </button>
                                <button
                                    onClick={() => onDelete(review.id)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-surface-2 text-text-secondary hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                    title="Delete"
                                >
                                    <Icon icon="solar:trash-bin-trash-linear" width="12" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {review.body && (
                    <div className="mt-4 relative">
                        <div className="absolute -left-1.5 top-0 w-0.5 h-full bg-brand/10 rounded-full" />
                        <p className={`text-text-secondary text-xs sm:text-sm leading-relaxed pl-3 italic opacity-95 ${!expanded && isLongText ? 'line-clamp-3' : ''}`}>
                            {review.body}
                        </p>
                        {isLongText && (
                            <button
                                type="button"
                                onClick={() => onOpenOverlay ? onOpenOverlay() : setExpanded(!expanded)}
                                className="text-[11px] font-bold text-brand hover:underline mt-1.5 pl-3 block cursor-pointer"
                            >
                                {expanded ? 'Show less' : 'Read full review →'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// Third-party review (YouTube comment)
const ExternalReviewCard = ({ review, onOpenOverlay }) => {
    const [expanded, setExpanded] = useState(false);
    const name = review.author_name || 'YouTube viewer';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const isLongText = (review.body || '').length > 180;

    return (
        <div className="bg-surface border border-border rounded-xl p-5 transition-all duration-300 hover:shadow-md hover:border-red-500/30 relative flex flex-col justify-between h-full">
            <div>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        {review.author_avatar_url ? (
                            <img src={review.author_avatar_url} alt="" referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-full object-cover border-2 border-surface-2 shrink-0" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-red-500/5 border-2 border-red-500/10 flex items-center justify-center text-red-500 font-black text-xs shrink-0">
                                {initials}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-text-primary font-bold text-sm tracking-tight truncate">{name}</p>
                            <span className="inline-flex items-center gap-1 mt-0.5 text-[8px] font-black uppercase tracking-widest text-red-500/90 bg-red-500/5 border border-red-500/10 px-1.5 py-0.5 rounded">
                                <Icon icon="mdi:youtube" className="text-[10px]" /> via YouTube
                            </span>
                        </div>
                    </div>
                    {review.likes > 0 && (
                        <span className="text-text-muted text-[10px] font-bold flex items-center gap-1 shrink-0 bg-surface-2/60 px-2 py-0.5 rounded-lg border border-border">
                            <Icon icon="solar:like-bold" className="text-xs text-text-secondary" /> {review.likes.toLocaleString()}
                        </span>
                    )}
                </div>
                {review.body && (
                    <div className="mt-4 relative">
                        <div className="absolute -left-1.5 top-0 w-0.5 h-full bg-red-500/10 rounded-full" />
                        <p className={`text-text-secondary text-xs sm:text-sm leading-relaxed pl-3 opacity-95 ${!expanded && isLongText ? 'line-clamp-3' : ''}`}>
                            {review.body}
                        </p>
                        {isLongText && (
                            <button
                                type="button"
                                onClick={() => onOpenOverlay ? onOpenOverlay() : setExpanded(!expanded)}
                                className="text-[11px] font-bold text-red-400 hover:underline mt-1.5 pl-3 block cursor-pointer"
                            >
                                {expanded ? 'Show less' : 'Read full review →'}
                            </button>
                        )}
                    </div>
                )}
            </div>
            {review.source_url && (
                <div className="mt-3 pt-2 border-t border-border/40">
                    <a href={review.source_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-text-muted hover:text-red-500 transition-colors">
                        View comment on YouTube <Icon icon="solar:arrow-right-up-linear" />
                    </a>
                </div>
            )}
        </div>
    );
};

const ReviewForm = ({
    onSubmit,
    onCancel,
    initialRating = 0,
    initialBody = '',
    isEditing = false,
    itemLabel = 'production'
}) => {
    const [rating, setRating] = useState(initialRating)
    const [body, setBody] = useState(initialBody)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)

        if (rating === 0) {
            setError('Please award a star rating first.')
            return
        }
        if (body.trim().length < 20) {
            setError('Your thoughts are too short! (Min 20 characters)')
            return
        }

        setSubmitting(true)
        const success = await onSubmit(rating, body)
        setSubmitting(false)
        if (!success) setError('Synchronization failed. Please try again.')
    }

    return (
        <form onSubmit={handleSubmit} className="bg-surface border-2 border-brand/20 rounded-2xl p-6 space-y-6 shadow-xl shadow-brand/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full -translate-y-16 translate-x-16 blur-3xl pointer-events-none" />
            
            <div className="relative z-10">
                <h4 className="text-text-primary text-lg font-bold tracking-tight">
                    {isEditing ? 'Edit Your Review' : `Write a Review for this ${itemLabel}`}
                </h4>
                <p className="text-text-muted text-[10px] font-bold tracking-wider mt-1">
                    {isEditing ? 'Update your feedback' : 'Share your thoughts with the theatre & film community'}
                </p>
            </div>

            <div className="space-y-2">
                <label className="text-text-secondary text-xs font-bold block tracking-wider">What did you think?</label>
                <div className="p-4 bg-surface-2 rounded-xl border border-border">
                    <StarRating value={rating} onChange={setRating} />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-text-secondary text-xs font-bold block tracking-wider">Your Review</label>
                <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Write your review here..."
                    rows={4}
                    className="w-full bg-surface-2 border border-border text-text-primary rounded-xl px-5 py-4 text-sm focus:border-brand focus:ring-4 focus:ring-brand/10 focus:outline-none resize-none placeholder-text-muted transition-all leading-relaxed"
                />
                <div className="flex justify-between items-center px-1">
                    <p className={`text-[9px] font-bold tracking-widest ${body.length < 20 ? 'text-amber-500' : 'text-text-muted'}`}>
                        {body.length < 20 ? `${20 - body.length} characters to go` : 'Ready to post'}
                    </p>
                    <p className="text-[9px] text-text-muted font-bold">{body.length} characters</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/5 border border-red-500/20 text-red-500 text-xs px-4 py-3 rounded-xl font-bold flex items-center gap-2">
                    <Icon icon="solar:danger-triangle-linear" className="text-lg" /> {error}
                </div>
            )}

            <div className="flex gap-4 pt-2">
                <button
                    type="submit"
                    disabled={submitting}
                    className="flex-[2] bg-brand text-white font-bold py-4 rounded-xl text-sm btn-hover shadow-lg shadow-brand/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                    {submitting ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Posting...</span>
                        </>
                    ) : (
                        <span>{isEditing ? 'Save Changes' : 'Post Review'}</span>
                    )}
                </button>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 bg-surface-2 text-text-secondary font-bold py-4 rounded-xl text-sm transition-all hover:bg-surface-3 cursor-pointer"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    )
}

const ReviewsOverlayModal = ({
    isOpen,
    onClose,
    allItems,
    communityItems,
    audienceItems,
    averageRating,
    audienceRating,
    filmTitle,
    isPlay,
    currentUser,
    onEdit,
    onDelete,
}) => {
    const [filterTab, setFilterTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const baseList = (() => {
        if (filterTab === 'community') return communityItems;
        if (filterTab === 'audience') return audienceItems;
        return allItems;
    })();

    const filtered = baseList.filter(item => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const author = (item.data.author_name || item.data.users?.name || '').toLowerCase();
        const body = (item.data.body || '').toLowerCase();
        return author.includes(q) || body.includes(q);
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
            {/* Backdrop click to close */}
            <div 
                className="absolute inset-0 cursor-pointer" 
                onClick={onClose} 
                aria-label="Close overlay"
            />
            
            <div className="relative z-10 bg-[#0A0D12] border border-white/15 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Modal Header */}
                <div className="p-5 sm:p-6 border-b border-white/10 bg-surface/90 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand/10 border border-brand/30 text-brand text-[10px] font-black uppercase tracking-wider">
                                    <Icon icon="solar:verified-check-bold" className="text-xs" />
                                    Rotten Tomatoes Style Audience Overlay
                                </span>
                                <span className="text-xs text-text-muted font-bold">
                                    {allItems.length} verified audience reactions
                                </span>
                            </div>
                            <h3 className="font-heading font-black text-xl sm:text-2xl text-text-primary tracking-tight truncate">
                                {filmTitle ? `Audience Reviews: ${filmTitle}` : `All Audience Reviews`}
                            </h3>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-10 h-10 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-muted hover:text-text-primary flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0"
                            title="Close (Esc)"
                        >
                            <Icon icon="solar:close-circle-bold" className="text-2xl" />
                        </button>
                    </div>

                    {/* Rotten Tomatoes Dual-Badge Consensus Dock */}
                    <div className="flex flex-wrap items-center gap-4 bg-surface-2/70 border border-border rounded-xl p-3 sm:p-4">
                        {audienceRating && (
                            <div className="flex items-center gap-3 pr-4 border-r border-border/80">
                                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-500">
                                    <Icon icon="mdi:popcorn" className="text-2xl" />
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="font-heading font-black text-lg text-text-primary">{audienceRating}</span>
                                        <span className="text-[10px] text-text-muted">/10</span>
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-wider text-red-400 block">
                                        Audience Score
                                    </span>
                                </div>
                            </div>
                        )}

                        {averageRating && (
                            <div className="flex items-center gap-3 pr-4 border-r border-border/80">
                                <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/25 flex items-center justify-center text-brand">
                                    <Icon icon="solar:star-bold" className="text-xl" />
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="font-heading font-black text-lg text-text-primary">{averageRating}</span>
                                        <span className="text-[10px] text-text-muted">/10</span>
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-wider text-brand block">
                                        MuviDB Score
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="hidden sm:flex items-center gap-2 text-xs text-text-muted ml-auto">
                            <Icon icon="solar:shield-check-bold" className="text-emerald-400 text-sm" />
                            <span className="text-[11px] font-medium">All reviews displayed in full with verified credentials</span>
                        </div>
                    </div>

                    {/* Filter Tabs & Instant Search */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                            <button
                                type="button"
                                onClick={() => setFilterTab('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                                    filterTab === 'all'
                                        ? 'bg-brand text-white shadow-sm shadow-brand/20'
                                        : 'bg-surface-2 text-text-muted hover:text-text-primary'
                                }`}
                            >
                                All ({allItems.length})
                            </button>
                            {communityItems.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('community')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                                        filterTab === 'community'
                                            ? 'bg-brand text-white shadow-sm shadow-brand/20'
                                            : 'bg-surface-2 text-text-muted hover:text-text-primary'
                                    }`}
                                >
                                    Community ({communityItems.length})
                                </button>
                            )}
                            {audienceItems.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('audience')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                                        filterTab === 'audience'
                                            ? 'bg-brand text-white shadow-sm shadow-brand/20'
                                            : 'bg-surface-2 text-text-muted hover:text-text-primary'
                                    }`}
                                >
                                    YouTube Audience ({audienceItems.length})
                                </button>
                            )}
                        </div>

                        <div className="relative min-w-[220px]">
                            <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs" />
                            <input
                                type="text"
                                placeholder="Search reviews..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-surface-2 border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-brand"
                            />
                        </div>
                    </div>
                </div>

                {/* Modal Scrollable Reviews List */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                    {filtered.length === 0 ? (
                        <div className="py-16 text-center text-text-muted">
                            <Icon icon="solar:magnifer-outline" className="text-4xl mx-auto mb-2 opacity-30" />
                            <p className="text-sm font-bold">No reviews match your filter</p>
                            <p className="text-xs mt-1">Try clearing your search query.</p>
                        </div>
                    ) : (
                        filtered.map(item => (
                            <div key={item.id} className="bg-surface border border-border hover:border-brand/30 rounded-xl p-5 sm:p-6 transition-all shadow-sm">
                                {item.type === 'community' ? (
                                    <div>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                {item.data.users?.avatar_url ? (
                                                    <img 
                                                        src={item.data.users.avatar_url} 
                                                        alt="" 
                                                        className="w-11 h-11 rounded-full object-cover border-2 border-surface-2 shrink-0" 
                                                    />
                                                ) : (
                                                    <div className="w-11 h-11 rounded-full bg-brand/10 border-2 border-brand/20 flex items-center justify-center text-brand font-black text-xs shrink-0">
                                                        {(item.data.users?.name || 'A').slice(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-text-primary font-bold text-sm tracking-tight truncate">
                                                            {item.data.users?.name || 'Anonymous User'}
                                                        </p>
                                                        {/* RT Verified Badge */}
                                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                                            <Icon icon="solar:verified-check-bold" className="text-xs" />
                                                            Verified Audience
                                                        </span>
                                                    </div>
                                                    <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                                        {new Date(item.data.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Score */}
                                            <div className="text-brand font-black text-sm tracking-tight flex items-center gap-1 bg-brand/10 border border-brand/20 px-2.5 py-1 rounded-lg shrink-0">
                                                <Icon icon="solar:star-bold" className="text-xs" />
                                                <span>{item.data.rating}</span>
                                                <span className="text-[10px] text-text-muted font-normal">/10</span>
                                            </div>
                                        </div>

                                        {/* Full review body */}
                                        <div className="mt-4 relative pl-3 border-l-2 border-brand/25">
                                            <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line italic">
                                                {item.data.body}
                                            </p>
                                        </div>

                                        {/* Actions if owner */}
                                        {currentUser?.id === item.data.user_id && (
                                            <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center gap-2 justify-end">
                                                <button
                                                    onClick={() => { onClose(); onEdit?.(item.data); }}
                                                    className="text-xs text-text-muted hover:text-brand font-bold transition-colors cursor-pointer flex items-center gap-1"
                                                >
                                                    <Icon icon="solar:pen-linear" />
                                                    <span>Edit</span>
                                                </button>
                                                <button
                                                    onClick={() => { onDelete?.(item.data.id); }}
                                                    className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors cursor-pointer flex items-center gap-1 ml-2"
                                                >
                                                    <Icon icon="solar:trash-bin-trash-linear" />
                                                    <span>Delete</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                {item.data.author_avatar_url ? (
                                                    <img 
                                                        src={item.data.author_avatar_url} 
                                                        alt="" 
                                                        referrerPolicy="no-referrer"
                                                        className="w-11 h-11 rounded-full object-cover border-2 border-surface-2 shrink-0" 
                                                    />
                                                ) : (
                                                    <div className="w-11 h-11 rounded-full bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center text-red-400 font-black text-xs shrink-0">
                                                        {(item.data.author_name || 'YT').slice(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-text-primary font-bold text-sm tracking-tight truncate">
                                                            {item.data.author_name || 'YouTube Viewer'}
                                                        </p>
                                                        {/* RT Style Badge */}
                                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                                                            <Icon icon="mdi:youtube" className="text-xs" />
                                                            via YouTube
                                                        </span>
                                                    </div>
                                                    <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                                        Audience Reaction
                                                    </p>
                                                </div>
                                            </div>

                                            {item.data.likes > 0 && (
                                                <span className="text-text-muted text-[11px] font-bold flex items-center gap-1 shrink-0 bg-surface-2 px-2.5 py-1 rounded-lg border border-border">
                                                    <Icon icon="solar:like-bold" className="text-xs text-text-secondary" />
                                                    {item.data.likes.toLocaleString()}
                                                </span>
                                            )}
                                        </div>

                                        {/* Full review body */}
                                        <div className="mt-4 relative pl-3 border-l-2 border-red-500/25">
                                            <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">
                                                {item.data.body}
                                            </p>
                                        </div>

                                        {item.data.source_url && (
                                            <div className="mt-3.5 pt-2 border-t border-border/50">
                                                <a
                                                    href={item.data.source_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
                                                >
                                                    <span>View comment on YouTube</span>
                                                    <Icon icon="solar:arrow-right-up-linear" />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

const ReviewSection = ({ filmId, playId, currentUser, filmTitle = '', filmSlug = '' }) => {
    const navigate = useNavigate()
    const {
        reviews,
        externalReviews,
        userReview,
        loading,
        submitReview,
        deleteReview
    } = useReviews({ filmId, playId }, currentUser)

    const [showForm, setShowForm] = useState(false)
    const [editingReview, setEditingReview] = useState(null)
    const [activeTab, setActiveTab] = useState('all') // 'all' | 'community' | 'audience'
    const [visibleLimit, setVisibleLimit] = useState(6)
    const [showAllOverlay, setShowAllOverlay] = useState(false)

    const isPlay = Boolean(playId);

    const handleSubmit = async (rating, body) => {
        const success = await submitReview(rating, body)
        if (success) {
            setShowForm(false)
            setEditingReview(null)
        }
        return success
    }

    const handleEdit = (review) => {
        setEditingReview(review)
        setShowForm(false)
    }

    const handleDelete = async (reviewId) => {
        if (window.confirm('Strike this review from the records?')) {
            await deleteReview(reviewId)
        }
    }

    const averageRating = reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : null

    const audienceRating = (() => {
        if (!externalReviews.length) return null
        let num = 0, den = 0
        for (const r of externalReviews) {
            const w = 1 + Math.log10(1 + Math.max(0, r.likes || 0))
            num += (Number(r.sentiment_score) || 0) * w
            den += w
        }
        if (!den) return null
        const n = externalReviews.length
        const adjusted = (n * (num / den) + 10 * 8.0) / (n + 10)
        return Math.min(9.7, adjusted).toFixed(1)
    })()

    const communityItems = reviews
        .filter(r => editingReview?.id !== r.id)
        .map(r => ({ type: 'community', data: r, id: `comm_${r.id}` }))

    const audienceItems = externalReviews.map(r => ({
        type: 'audience',
        data: r,
        id: `ext_${r.id}`
    }))

    const allItems = [...communityItems, ...audienceItems]

    const displayedList = (() => {
        if (activeTab === 'community') return communityItems
        if (activeTab === 'audience') return audienceItems
        return allItems
    })()

    const visibleItems = displayedList.slice(0, visibleLimit)
    const totalCount = allItems.length

    return (
        <div id="reviews-section" className="space-y-6 pt-2 my-10">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-6">
                <div>
                    <h3 className="font-heading font-bold text-2xl md:text-[1.75rem] text-text-primary tracking-tight leading-none">
                        Audience Reviews & Reactions
                    </h3>
                    <div className="text-text-muted text-xs font-bold tracking-wide mt-2 flex flex-wrap items-center gap-2.5">
                        <span>{totalCount} total reaction{totalCount !== 1 ? 's' : ''}</span>
                        {averageRating && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-border" />
                                <span className="text-brand flex items-center gap-1">
                                    <Icon icon="solar:star-bold" className="text-sm" />
                                    {averageRating} MuviDB Avg
                                </span>
                            </>
                        )}
                        {audienceRating && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-border" />
                                <span className="text-red-400 flex items-center gap-1">
                                    <Icon icon="mdi:youtube" className="text-sm" />
                                    {audienceRating} Audience Avg
                                </span>
                            </>
                        )}
                        {totalCount > 6 && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-border" />
                                <button
                                    type="button"
                                    onClick={() => setShowAllOverlay(true)}
                                    className="text-brand hover:text-brand-hover transition-colors font-bold cursor-pointer inline-flex items-center gap-1"
                                >
                                    <span>Show all ({totalCount}) →</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {!userReview && !showForm && !editingReview && (
                    <button
                        onClick={() => currentUser ? setShowForm(true) : navigate('/login')}
                        className="bg-brand text-white font-bold px-6 py-3 rounded-xl text-xs sm:text-sm btn-hover shadow-lg shadow-brand/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                    >
                        <Icon icon="solar:pen-new-square-linear" width="16" />
                        <span>{currentUser ? `Review this ${isPlay ? 'Play' : 'Film'}` : 'Sign in to review'}</span>
                    </button>
                )}
            </div>

            {/* Posting Context */}
            {(showForm || editingReview) && (
                <div className="page-fade-in max-w-2xl">
                    <ReviewForm
                        onSubmit={handleSubmit}
                        onCancel={() => { setShowForm(false); setEditingReview(null); }}
                        initialRating={editingReview?.rating}
                        initialBody={editingReview?.body}
                        isEditing={!!editingReview}
                        itemLabel={isPlay ? 'Stage Play' : 'Film'}
                    />
                </div>
            )}

            {/* Filter Tabs (when both community and external exist) */}
            {totalCount > 0 && (communityItems.length > 0 && audienceItems.length > 0) && (
                <div className="flex items-center gap-2 border-b border-border/60 pb-3 overflow-x-auto">
                    <button
                        onClick={() => { setActiveTab('all'); setVisibleLimit(6); }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'all'
                                ? 'bg-brand text-white shadow-sm shadow-brand/20'
                                : 'bg-surface-2 text-text-secondary hover:text-text-primary hover:bg-surface-3'
                        }`}
                    >
                        <span>All Reviews</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-surface-3 text-text-muted'
                        }`}>
                            {totalCount}
                        </span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('community'); setVisibleLimit(6); }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'community'
                                ? 'bg-brand text-white shadow-sm shadow-brand/20'
                                : 'bg-surface-2 text-text-secondary hover:text-text-primary hover:bg-surface-3'
                        }`}
                    >
                        <Icon icon="solar:user-bold" className="text-xs" />
                        <span>Community</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            activeTab === 'community' ? 'bg-white/20 text-white' : 'bg-surface-3 text-text-muted'
                        }`}>
                            {communityItems.length}
                        </span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('audience'); setVisibleLimit(6); }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'audience'
                                ? 'bg-brand text-white shadow-sm shadow-brand/20'
                                : 'bg-surface-2 text-text-secondary hover:text-text-primary hover:bg-surface-3'
                        }`}
                    >
                        <Icon icon="mdi:youtube" className="text-xs" />
                        <span>YouTube Audience</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            activeTab === 'audience' ? 'bg-white/20 text-white' : 'bg-surface-3 text-text-muted'
                        }`}>
                            {audienceItems.length}
                        </span>
                    </button>
                </div>
            )}

            {/* Feed Context */}
            <div>
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-surface-2 rounded-xl h-36 animate-pulse border border-border" />
                        ))}
                    </div>
                ) : displayedList.length > 0 ? (
                    <div className="space-y-6">
                        {/* 2-column Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {visibleItems.map(item => (
                                <div key={item.id} className="page-fade-in flex flex-col">
                                    {item.type === 'community' ? (
                                        <ReviewCard
                                            review={item.data}
                                            currentUser={currentUser}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                            onOpenOverlay={() => setShowAllOverlay(true)}
                                        />
                                    ) : (
                                        <ExternalReviewCard 
                                            review={item.data} 
                                            onOpenOverlay={() => setShowAllOverlay(true)}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Show All Reviews Button (Opens Rotten Tomatoes Style Overlay) */}
                        {displayedList.length > 6 && (
                            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!isPlay && (filmSlug || filmId)) {
                                            navigate(`/films/${filmSlug || filmId}/reviews?tab=all_audience`);
                                        } else {
                                            setShowAllOverlay(true);
                                        }
                                    }}
                                    className="px-6 py-3 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border hover:border-brand/40 text-text-primary text-xs sm:text-sm font-bold transition-all flex items-center gap-2.5 shadow-sm hover:shadow-md cursor-pointer group"
                                >
                                    <Icon icon="solar:documents-minimalistic-bold" className="text-base text-brand group-hover:scale-110 transition-transform" />
                                    <span>Show all reviews ({displayedList.length})</span>
                                    <Icon icon="solar:alt-arrow-right-linear" className="text-sm text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-surface-2/40 border border-dashed border-border rounded-xl py-8 px-4 text-center">
                        <Icon icon="solar:clapperboard-play-linear" className="text-3xl mx-auto mb-3 opacity-25 text-brand" />
                        <h4 className="text-text-primary text-base font-bold tracking-tight">No audience reviews for this {isPlay ? 'stage play' : 'film'} yet</h4>
                        <p className="text-text-muted text-xs mt-1 max-w-xs mx-auto">Be the first to share your experience.</p>
                        {!showForm && (
                            <button
                                onClick={() => currentUser ? setShowForm(true) : navigate('/login')}
                                className="mt-4 text-brand font-bold text-xs hover:text-brand/80 transition-colors flex items-center justify-center gap-2 mx-auto cursor-pointer"
                            >
                                <Icon icon="solar:add-circle-linear" width="16" />
                                Write a Review
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Rotten Tomatoes Style Full Reviews Overlay Modal */}
            <ReviewsOverlayModal
                isOpen={showAllOverlay}
                onClose={() => setShowAllOverlay(false)}
                allItems={allItems}
                communityItems={communityItems}
                audienceItems={audienceItems}
                averageRating={averageRating}
                audienceRating={audienceRating}
                filmTitle={filmTitle}
                isPlay={isPlay}
                currentUser={currentUser}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />
        </div>
    )
}

export default ReviewSection;
