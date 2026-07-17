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
            <span className="text-xs font-black text-brand ml-3 bg-brand/5 px-2 py-0.5 rounded-full border border-brand/10">
                {value > 0 ? `${value}/10` : 'SCORE'}
            </span>
        </div>
    )
}

const ReviewCard = ({
    review,
    currentUser,
    onEdit,
    onDelete
}) => {
    const [timeRemaining, setTimeRemaining] = useState(null);
    
    // Check if the review is still editable (within 5 minutes of creation).
    // NB: this is UX only — the real enforcement is the RLS policy on the DB.
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

    return (
        <div className="bg-surface border border-border rounded-xl p-6 transition-all duration-300 hover:shadow-md group relative overflow-hidden">
            <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-surface-2 group-hover:border-brand/30 transition-all shadow-sm" />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-brand/5 border-2 border-brand/10 flex items-center justify-center text-brand font-black text-xs">
                                {initials}
                            </div>
                        )}
                        {isOwner && isEditable && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-brand rounded-full border-2 border-surface flex items-center justify-center animate-pulse">
                                <Icon icon="solar:info-circle-bold" className="text-[10px] text-white" />
                            </div>
                        )}
                    </div>
                    <div>
                        <p className="text-text-primary font-bold text-sm tracking-tight">{userName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-text-muted text-[10px] font-black uppercase tracking-widest px-0.5">
                                {new Date(review.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            {isOwner && isEditable && timeRemaining > 0 && (
                                <span className="text-brand text-[8px] font-bold bg-brand/5 px-2 py-0.5 rounded italic">
                                    Edit window: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-brand font-black text-lg tracking-tighter flex items-center gap-1">
                        <Icon icon="solar:star-bold" className="text-sm" />
                        {review.rating}<span className="text-[10px] text-text-muted">/10</span>
                    </div>
                    {isOwner && isEditable && (
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                                onClick={() => onEdit(review)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-2 text-text-secondary hover:bg-brand hover:text-white transition-all shadow-sm"
                                title="Edit (5 min limit)"
                            >
                                <Icon icon="solar:pen-linear" width="14" />
                            </button>
                            <button
                                onClick={() => onDelete(review.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-2 text-text-secondary hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                title="Delete (5 min limit)"
                            >
                                <Icon icon="solar:trash-bin-trash-linear" width="14" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {review.body && (
                <div className="mt-5 relative">
                    <div className="absolute -left-1.5 top-0 w-0.5 h-full bg-brand/10 rounded-full" />
                    <p className="text-text-secondary text-sm leading-[1.6] pl-4 italic opacity-90">
                        {review.body}
                    </p>
                </div>
            )}
        </div>
    )
}

// Third-party review (YouTube comment) — clearly badged, author NOT clickable
// (they're not our users), no edit/delete, links out to the original comment.
const ExternalReviewCard = ({ review }) => {
    const name = review.author_name || 'YouTube viewer';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return (
        <div className="bg-surface border border-border rounded-xl p-6 transition-all duration-300 hover:shadow-md relative overflow-hidden">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    {review.author_avatar_url ? (
                        <img src={review.author_avatar_url} alt="" referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-full object-cover border-2 border-surface-2" />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-red-500/5 border-2 border-red-500/10 flex items-center justify-center text-red-500 font-black text-xs">
                            {initials}
                        </div>
                    )}
                    <div>
                        {/* plain text — deliberately not a link */}
                        <p className="text-text-primary font-bold text-sm tracking-tight">{name}</p>
                        <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-black uppercase tracking-widest text-red-500/90 bg-red-500/5 border border-red-500/10 px-2 py-0.5 rounded-full">
                            <Icon icon="mdi:youtube" className="text-xs" /> via YouTube
                        </span>
                    </div>
                </div>
                {/* No per-comment score — the commenter never rated the film.
                    Their sentiment only feeds the movie's aggregate rating. */}
                {review.likes > 0 && (
                    <span className="text-text-muted text-[11px] font-bold flex items-center gap-1 shrink-0">
                        <Icon icon="solar:like-bold" className="text-xs" /> {review.likes.toLocaleString()}
                    </span>
                )}
            </div>
            {review.body && (
                <div className="mt-5 relative">
                    <div className="absolute -left-1.5 top-0 w-0.5 h-full bg-red-500/10 rounded-full" />
                    <p className="text-text-secondary text-sm leading-[1.6] pl-4 opacity-90">{review.body}</p>
                </div>
            )}
            {review.source_url && (
                <a href={review.source_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-4 text-[10px] font-bold text-text-muted hover:text-red-500 transition-colors">
                    View on YouTube <Icon icon="solar:arrow-right-up-linear" />
                </a>
            )}
        </div>
    );
};

const ReviewForm = ({
    onSubmit,
    onCancel,
    initialRating = 0,
    initialBody = '',
    isEditing = false
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
                    {isEditing ? 'Edit Your Review' : 'Write a Review'}
                </h4>
                <p className="text-text-muted text-[10px] font-bold tracking-wider mt-1">
                    {isEditing ? 'Update your feedback' : 'Share your thoughts with the community'}
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
                    className="flex-[2] bg-brand text-white font-bold py-4 rounded-xl text-sm btn-hover shadow-lg shadow-brand/20 flex items-center justify-center gap-2 disabled:opacity-50"
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
                        className="flex-1 bg-surface-2 text-text-secondary font-bold py-4 rounded-xl text-sm transition-all hover:bg-surface-3"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    )
}

const ReviewSection = ({ filmId, currentUser }) => {
    const navigate = useNavigate()
    const {
        reviews,
        externalReviews,
        userReview,
        loading,
        submitReview,
        deleteReview
    } = useReviews(filmId, currentUser)

    const [showForm, setShowForm] = useState(false)
    const [editingReview, setEditingReview] = useState(null)

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

    // Movie's audience rating = likes-weighted mean of comment sentiment.
    // (Same formula the sync stores on the film; recomputed here so the header
    // reflects exactly what's shown.)
    const audienceRating = (() => {
        if (!externalReviews.length) return null
        let num = 0, den = 0
        for (const r of externalReviews) {
            const w = 1 + Math.log10(1 + Math.max(0, r.likes || 0))
            num += (Number(r.sentiment_score) || 0) * w
            den += w
        }
        if (!den) return null
        // Bayesian shrinkage toward the global mean so a few glowing comments
        // don't read as near-perfect, then hard-cap at 9.7. Must match the
        // formula the sync stores (comment_reviews.ts scoreRating).
        const n = externalReviews.length
        const adjusted = (n * (num / den) + 10 * 8.0) / (n + 10)
        return Math.min(9.7, adjusted).toFixed(1)
    })()

    return (
        <div className="space-y-8 pt-2">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-6">
                <div>
                    <h3 className="text-text-primary text-2xl font-bold tracking-tight">
                        User Reviews
                    </h3>
                    <p className="text-text-muted text-xs font-bold tracking-wide mt-1.5 flex items-center gap-2">
                        {reviews.length} User Review{reviews.length !== 1 ? 's' : ''} 
                        {averageRating && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-border" />
                                <span className="text-brand flex items-center gap-1">
                                    <Icon icon="solar:star-bold" className="text-sm" />
                                    {averageRating} Average
                                </span>
                            </>
                        )}
                    </p>
                </div>

                {!userReview && !showForm && !editingReview && (
                    <button
                        onClick={() => currentUser ? setShowForm(true) : navigate('/login')}
                        className="bg-brand text-white font-bold px-8 py-3.5 rounded-xl text-sm btn-hover shadow-lg shadow-brand/20 flex items-center justify-center gap-2"
                    >
                        <Icon icon="solar:pen-new-square-linear" width="16" />
                        <span>{currentUser ? 'Write a Review' : 'Sign in to review'}</span>
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
                    />
                </div>
            )}

            {/* Feed Context */}
            <div className="space-y-6">
                {loading ? (
                    <div className="space-y-3">
                        {[1].map(i => (
                            <div key={i} className="bg-surface-2 rounded-lg h-28 animate-pulse border border-border" />
                        ))}
                    </div>
                ) : reviews.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6">
                        {reviews.map(review => (
                            editingReview?.id === review.id ? null : (
                                <div key={review.id} className="page-fade-in">
                                    <ReviewCard
                                        review={review}
                                        currentUser={currentUser}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                    />
                                </div>
                            )
                        ))}
                    </div>
                ) : externalReviews.length === 0 ? (
                    <div className="bg-surface-2/40 border border-dashed border-border rounded-lg py-8 px-4 text-center">
                        <Icon icon="solar:clapperboard-play-linear" className="text-3xl mx-auto mb-3 opacity-25 text-brand" />
                        <h4 className="text-text-primary text-base font-bold tracking-tight">No reviews yet</h4>
                        <p className="text-text-muted text-xs mt-1 max-w-xs mx-auto">Be the first to share your thoughts.</p>
                        {!showForm && (
                            <button
                                onClick={() => currentUser ? setShowForm(true) : navigate('/login')}
                                className="mt-5 text-brand font-bold text-xs hover:text-brand/80 transition-colors flex items-center justify-center gap-2 mx-auto"
                            >
                                <Icon icon="solar:add-circle-linear" width="16" />
                                Write a Review
                            </button>
                        )}
                    </div>
                ) : null}
            </div>

            {/* What viewers are saying — mined from YouTube comments */}
            {externalReviews.length > 0 && (
                <div className="space-y-6 pt-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-4">
                        <Icon icon="mdi:youtube" className="text-red-500 text-xl" />
                        <h3 className="text-text-primary text-lg font-bold tracking-tight">What viewers are saying</h3>
                        {audienceRating && (
                            <span className="text-brand flex items-center gap-1 text-sm font-black">
                                <Icon icon="solar:star-bold" className="text-sm" />
                                {audienceRating}<span className="text-[10px] text-text-muted">/10</span>
                            </span>
                        )}
                        <span className="text-text-muted text-[10px] font-black uppercase tracking-widest">
                            · from {externalReviews.length} YouTube comment{externalReviews.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                        {externalReviews.map(r => (
                            <div key={r.id} className="page-fade-in">
                                <ExternalReviewCard review={r} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default ReviewSection;
