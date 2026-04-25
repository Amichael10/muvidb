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
    
    // Check if the review is still editable (within 2 minutes of creation)
    const getEditStatus = () => {
        const createdTime = new Date(review.created_at).getTime();
        const now = Date.now();
        const diffMs = now - createdTime;
        const diffMinutes = diffMs / 1000 / 60;
        const remainingSeconds = Math.max(0, 120 - Math.floor(diffMs / 1000));
        return { isEditable: diffMinutes < 2, remainingSeconds };
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
                                title="Edit (2 min limit)"
                            >
                                <Icon icon="solar:pen-linear" width="14" />
                            </button>
                            <button
                                onClick={() => onDelete(review.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-2 text-text-secondary hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                title="Delete (2 min limit)"
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

    return (
        <div className="space-y-10 pt-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-border pb-8">
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
                    <div className="space-y-4">
                        {[1, 2].map(i => (
                            <div key={i} className="bg-surface-2 rounded-2xl h-40 animate-pulse border border-border" />
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
                ) : (
                    <div className="bg-surface-2/50 border-2 border-dashed border-border rounded-3xl py-16 text-center">
                        <Icon icon="solar:clapperboard-play-linear" className="text-5xl mx-auto mb-4 opacity-20 text-brand" />
                        <h4 className="text-text-primary text-xl font-bold tracking-tight">No reviews yet.</h4>
                        <p className="text-text-muted text-sm mt-1 max-w-xs mx-auto">Be the first to review this movie and share your thoughts with the community.</p>
                        {!showForm && (
                            <button
                                onClick={() => currentUser ? setShowForm(true) : navigate('/login')}
                                className="mt-8 text-brand font-bold text-xs tracking-widest hover:scale-105 transition-all flex items-center justify-center gap-2 mx-auto"
                            >
                                <Icon icon="solar:add-circle-linear" width="16" />
                                Write a Review
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default ReviewSection;