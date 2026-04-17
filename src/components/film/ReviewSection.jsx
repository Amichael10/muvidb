import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReviews } from '../../hooks/useReviews'

const StarRating = ({ value, onChange, readonly = false }) => {
    const [hover, setHover] = useState(0)

    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <button
                    key={num}
                    type="button"
                    disabled={readonly}
                    onClick={() => !readonly && onChange?.(num)}
                    onMouseEnter={() => !readonly && setHover(num)}
                    onMouseLeave={() => !readonly && setHover(0)}
                    className={`text-lg transition-colors ${num <= (hover || value)
                            ? 'text-yellow-400'
                            : 'text-gray-600'
                        } ${readonly ? 'cursor-default' : 'cursor-pointer'}`}
                >
                    ★
                </button>
            ))}
            <span className="text-sm text-gray-400 ml-2">
                {value > 0 ? `${value}/10` : ''}
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
    const initials = review.users?.name
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

    const isOwner = currentUser?.id === review.user_id

    return (
        <div className="bg-[#13192B] rounded-2xl p-5 border border-[#252D45]">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    {review.users?.avatar_url ? (
                        <img
                            src={review.users.avatar_url}
                            alt={review.users.name}
                            className="w-10 h-10 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-[#D4A017] flex items-center justify-center text-black font-bold text-sm">
                            {initials}
                        </div>
                    )}
                    <div>
                        <p className="text-[#F5F0E8] font-medium text-sm">
                            {review.users?.name || 'Anonymous'}
                        </p>
                        <p className="text-[#7A8099] text-xs">
                            {new Date(review.created_at).toLocaleDateString(
                                'en-NG',
                                {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                }
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="bg-[#D4A017] text-black text-xs font-bold px-2 py-1 rounded-lg">
                        {review.rating}/10
                    </span>
                    {isOwner && (
                        <div className="flex gap-1">
                            <button
                                onClick={() => onEdit(review)}
                                className="text-[#7A8099] hover:text-[#D4A017] p-1 transition-colors"
                                title="Edit review"
                            >
                                ✏️
                            </button>
                            <button
                                onClick={() => onDelete(review.id)}
                                className="text-[#7A8099] hover:text-red-400 p-1 transition-colors"
                                title="Delete review"
                            >
                                🗑️
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {review.body && (
                <p className="text-[#F5F0E8] text-sm leading-relaxed">
                    {review.body}
                </p>
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
            setError('Please select a rating')
            return
        }
        if (body.trim().length < 20) {
            setError('Review must be at least 20 characters')
            return
        }

        setSubmitting(true)
        await onSubmit(rating, body)
        setSubmitting(false)
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="bg-[#13192B] rounded-2xl p-5 border border-[#252D45] space-y-4"
        >
            <h4 className="text-[#F5F0E8] font-semibold">
                {isEditing ? 'Edit your review' : 'Write a review'}
            </h4>

            <div>
                <label className="text-[#7A8099] text-xs block mb-2">
                    Your Rating
                </label>
                <StarRating value={rating} onChange={setRating} />
            </div>

            <div>
                <label className="text-[#7A8099] text-xs block mb-2">
                    Your Review
                </label>
                <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Share your thoughts about this film... (min 20 characters)"
                    rows={4}
                    className="w-full bg-[#0A0F1E] border border-[#252D45] text-[#F5F0E8] rounded-xl px-4 py-3 text-sm focus:border-[#D4A017] focus:outline-none resize-none placeholder-[#7A8099]"
                />
                <p className="text-[#7A8099] text-xs mt-1 text-right">
                    {body.length} characters
                    {body.length < 20 && body.length > 0 && (
                        <span className="text-amber-400">
                            {' '}(need {20 - body.length} more)
                        </span>
                    )}
                </p>
            </div>

            {error && (
                <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-xl">
                    {error}
                </p>
            )}

            <div className="flex gap-3">
                <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-[#D4A017] text-black font-semibold py-3 rounded-xl text-sm hover:bg-[#D4A017]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {submitting && (
                        <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    )}
                    {isEditing ? 'Update Review' : 'Post Review'}
                </button>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-3 text-[#7A8099] hover:text-[#F5F0E8] text-sm transition-colors"
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
    }

    const handleEdit = (review) => {
        setEditingReview(review)
        setShowForm(false)
    }

    const handleDelete = async (reviewId) => {
        if (window.confirm('Delete this review?')) {
            await deleteReview(reviewId)
        }
    }

    const averageRating = reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : null

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-[#F5F0E8] text-xl font-bold">
                        Reviews
                    </h3>
                    {averageRating && (
                        <p className="text-[#7A8099] text-sm mt-1">
                            <span className="text-[#D4A017] font-bold text-lg">
                                {averageRating}
                            </span>
                            /10 from {reviews.length} review
                            {reviews.length !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>

                {/* Write review button */}
                {currentUser ? (
                    !userReview && !showForm && !editingReview && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="bg-transparent border border-[#D4A017] text-[#D4A017] font-semibold px-5 py-2 rounded-full text-sm hover:bg-[#D4A017] hover:text-black transition-all"
                        >
                            Write a Review
                        </button>
                    )
                ) : (
                    <button
                        onClick={() => navigate('/login')}
                        className="bg-transparent border border-[#D4A017] text-[#D4A017] font-semibold px-5 py-2 rounded-full text-sm hover:bg-[#D4A017] hover:text-black transition-all"
                    >
                        Sign in to Review
                    </button>
                )}
            </div>

            {/* Write review form */}
            {showForm && currentUser && (
                <ReviewForm
                    onSubmit={handleSubmit}
                    onCancel={() => setShowForm(false)}
                />
            )}

            {/* Loading */}
            {loading && (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div
                            key={i}
                            className="bg-[#13192B] rounded-2xl p-5 animate-pulse h-32"
                        />
                    ))}
                </div>
            )}

            {/* Reviews list */}
            {!loading && (
                <div className="space-y-4">
                    {reviews.map(review => (
                        editingReview?.id === review.id ? (
                            <ReviewForm
                                key={review.id}
                                onSubmit={handleSubmit}
                                onCancel={() => setEditingReview(null)}
                                initialRating={review.rating}
                                initialBody={review.body || ''}
                                isEditing
                            />
                        ) : (
                            <ReviewCard
                                key={review.id}
                                review={review}
                                currentUser={currentUser}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        )
                    ))}

                    {/* Empty state */}
                    {reviews.length === 0 && (
                        <div className="text-center py-12">
                            <div className="text-5xl mb-3">🎬</div>
                            <p className="text-[#F5F0E8] font-medium">
                                No reviews yet
                            </p>
                            <p className="text-[#7A8099] text-sm mt-1">
                                Be the first to review this film
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default ReviewSection;