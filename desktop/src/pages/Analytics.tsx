import React, { useEffect, useMemo, useState } from 'react'
import { BarChart3, Clock3, Timer, Type, Mic2, RefreshCw, Star } from 'lucide-react'
import { resolveBackendBaseUrl } from '@/lib/backend'

type AnalyticsPayload = {
    updatedAt: string
    totals: {
        dictations: number
        words: number
        voiceSeconds: number
        voiceMinutes: number
        favorites: number
    }
    summary: {
        estimatedSecondsSaved: number
        estimatedMinutesSaved: number
        speakingWordsPerMinute: number
        averageWordsPerDictation: number
        averageVoiceSeconds: number
        favoriteRate: number
        fastestSpeakingWpm: number
        typingBaselineWpm: number
    }
    formulaNotes: string[]
}

type MetricRow = {
    title: string
    impact: string
    detail: string
    icon: React.ReactNode
}

export const Analytics: React.FC = () => {
    const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false

        const loadAnalytics = async () => {
            try {
                setLoading(true)
                setError('')

                const backendBaseUrl = await resolveBackendBaseUrl()
                const response = await fetch(`${backendBaseUrl}/api/v1/analytics`)
                if (!response.ok) {
                    const errorBody = await response.json().catch(() => null)
                    throw new Error(errorBody?.detail || `Backend returned ${response.status}`)
                }

                const payload = (await response.json()) as AnalyticsPayload
                if (!cancelled) {
                    setAnalytics(payload)
                }
            } catch (fetchError) {
                if (!cancelled) {
                    setError(fetchError instanceof Error ? fetchError.message : 'Failed to load analytics.')
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        void loadAnalytics()

        return () => {
            cancelled = true
        }
    }, [])

    const metricRows: MetricRow[] = useMemo(() => {
        if (!analytics) return []

        return [
            {
                title: 'Estimated time saved',
                impact: `${analytics.summary.estimatedMinutesSaved} min saved`,
                detail: `Based on a ${analytics.summary.typingBaselineWpm} WPM typing baseline versus your dictation speed.`,
                icon: <Timer className="w-4 h-4" />,
            },
            {
                title: 'Speaking speed',
                impact: `${analytics.summary.speakingWordsPerMinute} WPM`,
                detail: 'Calculated from total spoken words divided by recorded dictation time.',
                icon: <Mic2 className="w-4 h-4" />,
            },
            {
                title: 'Dictation frequency',
                impact: `${analytics.totals.dictations} sessions`,
                detail: 'Shows how many times dictation has been used and stored in the local database.',
                icon: <BarChart3 className="w-4 h-4" />,
            },
            {
                title: 'Words captured',
                impact: `${analytics.totals.words} words`,
                detail: 'Counts all dictation output saved to history.',
                icon: <Type className="w-4 h-4" />,
            },
            {
                title: 'Average session length',
                impact: `${analytics.summary.averageVoiceSeconds} sec`,
                detail: 'Average recorded voice duration per saved dictation.',
                icon: <Clock3 className="w-4 h-4" />,
            },
            {
                title: 'Favorite rate',
                impact: `${analytics.summary.favoriteRate}%`,
                detail: 'Percent of saved dictations marked as important.',
                icon: <Star className="w-4 h-4" />,
            },
        ]
    }, [analytics])

    return (
        <div className="flex-1 overflow-y-auto px-10 py-8 no-drag-region">
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-textMain">Analytics</h2>
                    <p className="text-textMuted text-[14px] mt-1">
                        Your dictation efficiency, usage frequency, and speaking speed, all stored locally.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="w-9 h-9 flex justify-center items-center rounded-xl bg-card border border-border text-textMuted hover:text-textMain hover:bg-secondaryBg transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {loading ? (
                <div />
            ) : error ? (
                <div className="bg-card border border-danger/20 rounded-3xl p-10 text-danger shadow-soft">
                    {error}
                </div>
            ) : analytics ? (
                <div className="space-y-6">
                    <div>
                        <div className="overflow-hidden rounded-2xl border border-border">
                            <table className="w-full text-left">
                                <thead className="bg-secondaryBg/60 text-[11px] uppercase tracking-wider text-textMuted">
                                    <tr>
                                        <th className="px-4 py-3">Title</th>
                                        <th className="px-4 py-3">Impact</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {metricRows.map((row) => (
                                        <tr key={row.title} className="border-t border-border/60">
                                            <td className="px-4 py-4 align-top">
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5 w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                        {row.icon}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-textMain">{row.title}</div>
                                                        <div className="text-xs text-textMuted mt-1 leading-relaxed">{row.detail}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 align-top font-bold text-textMain">{row.impact}</td>
                                        </tr>
                                    ))}

                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-card border border-border rounded-3xl p-6 shadow-soft">
                            <div className="text-[10px] uppercase tracking-wider text-textMuted font-bold">Voice Minutes Logged</div>
                            <div className="text-3xl font-bold text-textMain mt-2">{analytics.totals.voiceMinutes} min</div>
                            <p className="text-sm text-textMuted mt-2">Total captured speech stored in the SQLite history table.</p>
                        </div>
                        <div className="bg-card border border-border rounded-3xl p-6 shadow-soft">
                            <div className="text-[10px] uppercase tracking-wider text-textMuted font-bold">Favorites Saved</div>
                            <div className="text-3xl font-bold text-textMain mt-2">{analytics.totals.favorites}</div>
                            <p className="text-sm text-textMuted mt-2">Dictations you marked as important after saving.</p>
                        </div>
                        <div className="bg-card border border-border rounded-3xl p-6 shadow-soft">
                            <div className="text-[10px] uppercase tracking-wider text-textMuted font-bold">Updated</div>
                            <div className="text-3xl font-bold text-textMain mt-2">Live</div>
                            <p className="text-sm text-textMuted mt-2">Last computed at {new Date(analytics.updatedAt).toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-3xl p-6 shadow-soft">
                        <h3 className="text-lg font-bold text-textMain mb-4">Formula Notes</h3>
                        <ul className="space-y-2 text-sm text-textMuted">
                            {analytics.formulaNotes.map((note) => (
                                <li key={note} className="flex gap-3">
                                    <span>{note}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ) : null}
        </div>
    )
}