import { useState, useEffect, useMemo } from 'react';
import { Star, MessageSquare, Calendar, AlertTriangle, X, Info, CheckCheck, TrendingUp, TrendingDown, Minus, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useLocationFilter } from '../lib/useLocationFilter';

type GuestFeedback = {
  id: string;
  location_name: string;
  review_date: string;
  report_date: string;
  reviewer_name: string | null;
  review_source: string;
  overall_rating: number | null;
  food_rating: number | null;
  service_rating: number | null;
  ambience_rating: number | null;
  value_rating: number | null;
  review_text: string | null;
  visit_date: string | null;
  created_at: string;
};

type LowReview = GuestFeedback & { low_categories: string[] };

type CategoryTrend = {
  category: string;
  current: number | null;
  prior: number | null;
  direction: 'up' | 'down' | 'flat' | null;
  delta: number | null;
};

type LocationStats = {
  location_name: string;
  review_count: number;
  avg_rating: number;
  latest_review_date: string;
  latest_low_review_date: string;
  has_low_score: boolean;
  low_score_categories: string[];
  low_reviews: LowReview[];
  categoryTrends: CategoryTrend[];
};

type PortfolioStats = {
  totalReviews: number;
  last30Reviews: number;
  avgOverall: number | null;
  avgFood: number | null;
  avgService: number | null;
  avgAmbience: number | null;
  avgValue: number | null;
};

const CATEGORIES = ['Overall', 'Food', 'Service', 'Ambience', 'Value'] as const;

export default function GuestFeedbackView() {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<GuestFeedback[]>([]);
  const [locationStats, setLocationStats] = useState<LocationStats[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [dismissedReviewIds, setDismissedReviewIds] = useState<Set<string>>(new Set());
  const [alertPopup, setAlertPopup] = useState<LocationStats | null>(null);

  const locationFilter = useLocationFilter('feedback');

  useEffect(() => {
    const init = async () => {
      if (user) await loadDismissed();
      await loadFeedback();
    };
    init();
  }, [user]);

  const loadFeedback = async () => {
    setLoading(true);

    const { data: excludedLocs } = await supabase
      .from('locations')
      .select('name')
      .eq('exclude_from_reporting', true);

    const excludedNames = (excludedLocs || []).map(l => l.name);

    let query = supabase
      .from('guest_feedback')
      .select('*')
      .order('review_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (excludedNames.length > 0) {
      query = query.not('location_name', 'in', `(${excludedNames.join(',')})`);
    }

    const { data, error } = await query;

    if (!error && data) {
      setFeedbacks(data);
      computeStats(data);
    }
    setLoading(false);
  };

  const loadDismissed = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('dismissed_alerts')
      .select('location_name, dismissed_review_ids')
      .eq('user_id', user.id);
    if (error) return;
    if (data) {
      const ids = new Set<string>();
      data.forEach((r: { location_name: string; dismissed_review_ids: string[] }) => {
        (r.dismissed_review_ids ?? []).forEach(id => ids.add(id));
      });
      setDismissedReviewIds(ids);
    }
  };

  const computeStats = (data: GuestFeedback[]) => {
    const now = new Date();
    const cutoff30 = new Date(now);
    cutoff30.setDate(now.getDate() - 30);
    const cutoff60 = new Date(now);
    cutoff60.setDate(now.getDate() - 60);

    const statsMap = new Map<string, {
      count: number;
      totalRating: number;
      latestDate: string;
      minOverall: number | null;
      minFood: number | null;
      minService: number | null;
      minAmbience: number | null;
      minValue: number | null;
      allReviews: GuestFeedback[];
    }>();

    data.forEach((item: GuestFeedback) => {
      if (!statsMap.has(item.location_name)) {
        statsMap.set(item.location_name, {
          count: 0,
          totalRating: 0,
          latestDate: item.review_date,
          minOverall: null,
          minFood: null,
          minService: null,
          minAmbience: null,
          minValue: null,
          allReviews: [],
        });
      }

      const stats = statsMap.get(item.location_name)!;
      stats.count++;
      stats.allReviews.push(item);
      if (item.overall_rating) {
        stats.totalRating += item.overall_rating;
        if (stats.minOverall === null || item.overall_rating < stats.minOverall) stats.minOverall = item.overall_rating;
      }
      if (item.food_rating && (stats.minFood === null || item.food_rating < stats.minFood)) stats.minFood = item.food_rating;
      if (item.service_rating && (stats.minService === null || item.service_rating < stats.minService)) stats.minService = item.service_rating;
      if (item.ambience_rating && (stats.minAmbience === null || item.ambience_rating < stats.minAmbience)) stats.minAmbience = item.ambience_rating;
      if (item.value_rating && (stats.minValue === null || item.value_rating < stats.minValue)) stats.minValue = item.value_rating;
      if (item.review_date > stats.latestDate) stats.latestDate = item.review_date;
    });

    const statsArray = Array.from(statsMap.entries()).map(([location, stats]) => {
      const lowCategories: string[] = [];
      if (stats.minOverall !== null && stats.minOverall < 4) lowCategories.push('Overall');
      if (stats.minFood !== null && stats.minFood < 4) lowCategories.push('Food');
      if (stats.minService !== null && stats.minService < 4) lowCategories.push('Service');
      if (stats.minAmbience !== null && stats.minAmbience < 4) lowCategories.push('Ambience');
      if (stats.minValue !== null && stats.minValue < 4) lowCategories.push('Value');

      const lowReviews: LowReview[] = stats.allReviews
        .map((r) => {
          const cats: string[] = [];
          if (r.overall_rating !== null && r.overall_rating < 4) cats.push('Overall');
          if (r.food_rating !== null && r.food_rating < 4) cats.push('Food');
          if (r.service_rating !== null && r.service_rating < 4) cats.push('Service');
          if (r.ambience_rating !== null && r.ambience_rating < 4) cats.push('Ambience');
          if (r.value_rating !== null && r.value_rating < 4) cats.push('Value');
          return cats.length > 0 ? { ...r, low_categories: cats } : null;
        })
        .filter(Boolean) as LowReview[];

      const latestLowDate = lowReviews.reduce((best, r) => r.review_date > best ? r.review_date : best, '');

      const locLast30 = stats.allReviews.filter(r => new Date(r.review_date) >= cutoff30);
      const locPrior30 = stats.allReviews.filter(r => new Date(r.review_date) >= cutoff60 && new Date(r.review_date) < cutoff30);

      const catAvg = (reviews: GuestFeedback[], field: keyof GuestFeedback) => {
        const vals = reviews.map(r => r[field] as number | null).filter((v): v is number => v !== null);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      };

      const categoryTrends: CategoryTrend[] = [
        { category: 'Overall', field: 'overall_rating' },
        { category: 'Food', field: 'food_rating' },
        { category: 'Service', field: 'service_rating' },
        { category: 'Ambience', field: 'ambience_rating' },
        { category: 'Value', field: 'value_rating' },
      ].map(({ category, field }) => {
        const current = catAvg(locLast30, field as keyof GuestFeedback);
        const prior = catAvg(locPrior30, field as keyof GuestFeedback);
        let direction: 'up' | 'down' | 'flat' | null = null;
        let delta: number | null = null;
        if (current !== null && prior !== null) {
          delta = current - prior;
          if (Math.abs(delta) < 0.1) direction = 'flat';
          else direction = delta > 0 ? 'up' : 'down';
        }
        return { category, current, prior, direction, delta };
      });

      return {
        location_name: location,
        review_count: stats.count,
        avg_rating: stats.count > 0 ? stats.totalRating / stats.count : 0,
        latest_review_date: stats.latestDate,
        latest_low_review_date: latestLowDate,
        has_low_score: lowCategories.length > 0,
        low_score_categories: lowCategories,
        low_reviews: lowReviews,
        categoryTrends,
      };
    });

    statsArray.sort((a, b) => b.review_count - a.review_count);
    setLocationStats(statsArray);
  };

  const handleMarkAsRead = async (locationName: string, _unused: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    const currentStat = locationStats.find(s => s.location_name === locationName);
    const allLowIds = currentStat ? currentStat.low_reviews.map(r => r.id) : _unused;
    const { error: upsertError } = await supabase.from('dismissed_alerts').upsert({
      user_id: user.id,
      location_name: locationName,
      dismissed_review_ids: allLowIds,
      dismissed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,location_name' });
    if (!upsertError) {
      setDismissedReviewIds(prev => {
        const next = new Set(prev);
        allLowIds.forEach(id => next.add(id));
        return next;
      });
    }
    if (alertPopup?.location_name === locationName) setAlertPopup(null);
  };

  const handleRestoreAlert = async (locationName: string, lowReviewIds: string[]) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from('dismissed_alerts')
      .select('dismissed_review_ids')
      .eq('user_id', user.id)
      .eq('location_name', locationName)
      .maybeSingle();
    const remaining = (existing?.dismissed_review_ids ?? []).filter((id: string) => !lowReviewIds.includes(id));
    if (remaining.length === 0) {
      await supabase.from('dismissed_alerts').delete().eq('user_id', user.id).eq('location_name', locationName);
    } else {
      await supabase.from('dismissed_alerts').upsert({
        user_id: user.id,
        location_name: locationName,
        dismissed_review_ids: remaining,
        dismissed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,location_name' });
    }
    setDismissedReviewIds(prev => {
      const next = new Set(prev);
      lowReviewIds.forEach(id => next.delete(id));
      return next;
    });
  };

  const openAlertPopup = (stat: LocationStats, e: React.MouseEvent) => {
    e.stopPropagation();
    setAlertPopup(stat);
  };

  const visibleStats = useMemo(() => {
    if (!locationFilter.isFiltered || !locationFilter.hasPreferences) return locationStats;
    return locationStats.filter(s => locationFilter.preferredLocations.includes(s.location_name));
  }, [locationStats, locationFilter.isFiltered, locationFilter.hasPreferences, locationFilter.preferredLocations]);

  const filteredFeedbacks = useMemo(() => {
    let items = selectedLocation === 'all' ? feedbacks : feedbacks.filter(f => f.location_name === selectedLocation);
    if (locationFilter.isFiltered && locationFilter.hasPreferences) {
      items = items.filter(f => locationFilter.preferredLocations.includes(f.location_name));
    }
    return items;
  }, [feedbacks, selectedLocation, locationFilter.isFiltered, locationFilter.hasPreferences, locationFilter.preferredLocations]);

  const categoryLeaders = useMemo(() => {
    const base = locationFilter.isFiltered && locationFilter.hasPreferences
      ? feedbacks.filter(f => locationFilter.preferredLocations.includes(f.location_name))
      : feedbacks;

    const fieldMap: Record<string, keyof GuestFeedback> = {
      Overall: 'overall_rating',
      Food: 'food_rating',
      Service: 'service_rating',
      Ambience: 'ambience_rating',
      Value: 'value_rating',
    };

    const locAvg = (locName: string, field: keyof GuestFeedback) => {
      const vals = base
        .filter(f => f.location_name === locName)
        .map(f => f[field] as number | null)
        .filter((v): v is number => v !== null);
      return vals.length >= 3 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const locations = Array.from(new Set(base.map(f => f.location_name)));

    return CATEGORIES.map(cat => {
      let best: { name: string; avg: number } | null = null;
      for (const loc of locations) {
        const avg = locAvg(loc, fieldMap[cat]);
        if (avg !== null && (best === null || avg > best.avg)) {
          best = { name: loc, avg };
        }
      }
      return { category: cat, leader: best };
    });
  }, [feedbacks, locationFilter.isFiltered, locationFilter.hasPreferences, locationFilter.preferredLocations]);

  const portfolioStats = useMemo((): PortfolioStats | null => {
    const base = locationFilter.isFiltered && locationFilter.hasPreferences
      ? feedbacks.filter(f => locationFilter.preferredLocations.includes(f.location_name))
      : feedbacks;
    if (base.length === 0 && feedbacks.length === 0) return null;
    const now = new Date();
    const cutoff30 = new Date(now);
    cutoff30.setDate(now.getDate() - 30);
    const last30 = base.filter(f => new Date(f.review_date) >= cutoff30);
    const avgOf = (field: keyof GuestFeedback) => {
      const vals = base.map(f => f[field] as number | null).filter((v): v is number => v !== null);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    return {
      totalReviews: base.length,
      last30Reviews: last30.length,
      avgOverall: avgOf('overall_rating'),
      avgFood: avgOf('food_rating'),
      avgService: avgOf('service_rating'),
      avgAmbience: avgOf('ambience_rating'),
      avgValue: avgOf('value_rating'),
    };
  }, [feedbacks, locationFilter.isFiltered, locationFilter.hasPreferences, locationFilter.preferredLocations]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const extractReviewLink = (text: string): { cleanText: string; url: string | null } => {
    const match = text.match(/^([\s\S]*?)(?:\s*Go to [^<]*<(https?:\/\/[^>]+)>|<(https?:\/\/[^>]+)>)\s*$/);
    if (match) {
      return { cleanText: match[1].trim(), url: match[2] || match[3] };
    }
    const urlMatch = text.match(/^([\s\S]*?)\s*(https?:\/\/\S+)\s*$/);
    if (urlMatch && urlMatch[2].length > 40) {
      return { cleanText: urlMatch[1].trim(), url: urlMatch[2] };
    }
    return { cleanText: text, url: null };
  };

  const renderStars = (rating: number | null, compact = false) => {
    if (!rating) return <span className="text-slate-400 text-xs">N/A</span>;
    const isLow = rating < 4;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} ${
              star <= rating
                ? isLow ? 'fill-red-400 text-red-400' : 'fill-yellow-400 text-yellow-400'
                : 'text-slate-300'
            }`}
          />
        ))}
        <span className={`ml-1 ${compact ? 'text-xs' : 'text-sm'} font-semibold ${isLow ? 'text-red-600' : 'text-slate-700'}`}>
          {rating.toFixed(1)}
        </span>
      </div>
    );
  };

  const getRatingColor = (rating: number | null) => {
    if (!rating) return 'bg-slate-100 text-slate-600';
    if (rating >= 4.5) return 'bg-green-100 text-green-800';
    if (rating >= 3.5) return 'bg-blue-100 text-blue-800';
    if (rating >= 2.5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getRatingPillColor = (rating: number | null) => {
    if (!rating) return 'bg-slate-100 text-slate-500';
    if (rating >= 4.5) return 'bg-green-100 text-green-800';
    if (rating >= 4.0) return 'bg-emerald-100 text-emerald-800';
    if (rating >= 3.5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getSourceBadgeColor = (source: string) => {
    const sourceMap: { [key: string]: string } = {
      'Google': 'bg-blue-100 text-blue-800',
      'OpenTable': 'bg-red-100 text-red-800',
      'Facebook': 'bg-sky-100 text-sky-800',
      'TripAdvisor': 'bg-green-100 text-green-800',
      'Yelp': 'bg-orange-100 text-orange-800',
    };
    return sourceMap[source] || 'bg-slate-100 text-slate-800';
  };

  const TrendIcon = ({ direction, delta }: { direction: 'up' | 'down' | 'flat' | null; delta: number | null }) => {
    if (direction === null) return null;
    if (direction === 'up') return (
      <span className="flex items-center gap-0.5 text-green-600">
        <TrendingUp className="w-3 h-3" />
        <span className="text-xs font-medium">+{delta?.toFixed(1)}</span>
      </span>
    );
    if (direction === 'down') return (
      <span className="flex items-center gap-0.5 text-red-500">
        <TrendingDown className="w-3 h-3" />
        <span className="text-xs font-medium">{delta?.toFixed(1)}</span>
      </span>
    );
    return (
      <span className="flex items-center gap-0.5 text-slate-400">
        <Minus className="w-3 h-3" />
        <span className="text-xs">0.0</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading guest feedback...</div>
      </div>
    );
  }

  const isAlertRead = (stat: LocationStats) => {
    if (stat.low_reviews.length === 0) return true;
    return stat.low_reviews.every(r => dismissedReviewIds.has(r.id));
  };

  const visibleAlerts = locationStats.filter(s => s.has_low_score && !isAlertRead(s));
  const dismissedAlerts = locationStats.filter(s => s.has_low_score && isAlertRead(s));

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg shadow-sm p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Guest Feedback</h1>
            <p className="mt-1 text-slate-300">Reviews and ratings from all sources</p>
          </div>
          <MessageSquare className="w-12 h-12 text-slate-300" />
        </div>
      </div>

      {/* Score Roll-Up Summary Bar */}
      {portfolioStats && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-shrink-0">
              <div className="text-xs text-slate-500 font-medium">Total Reviews</div>
              <div className="text-2xl font-bold text-slate-800">{portfolioStats.totalReviews}</div>
              <div className="text-xs text-slate-500">{portfolioStats.last30Reviews} in last 30 days</div>
            </div>
            <div className="w-px h-10 bg-slate-200 flex-shrink-0 hidden sm:block" />
            <div className="flex flex-wrap gap-3 flex-1">
              {CATEGORIES.map(cat => {
                const key = `avg${cat}` as keyof PortfolioStats;
                const val = portfolioStats[key] as number | null;
                return (
                  <div key={cat} className="flex flex-col items-center gap-1">
                    <div className="text-xs text-slate-500 font-medium">{cat}</div>
                    <span className={`px-2.5 py-1 rounded-full text-sm font-bold ${getRatingPillColor(val)}`}>
                      {val !== null ? val.toFixed(2) : 'N/A'}
                    </span>
                  </div>
                );
              })}
            </div>
            {locationFilter.hasPreferences && (
              <div className="flex-shrink-0 ml-auto">
                <button
                  onClick={() => locationFilter.setIsFiltered(!locationFilter.isFiltered)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    locationFilter.isFiltered
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {locationFilter.isFiltered ? 'My Locations' : 'All Locations'}
                </button>
              </div>
            )}
          </div>

          {/* Category Leaders */}
          {categoryLeaders.some(l => l.leader !== null) && (
            <div className="border-t border-slate-100 pt-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Category Leaders</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {categoryLeaders.map(({ category, leader }) => (
                  <div key={category} className="bg-slate-50 rounded-lg px-3 py-2">
                    <div className="text-xs text-slate-500 font-medium mb-1">{category}</div>
                    {leader ? (
                      <>
                        <div className="text-xs font-semibold text-slate-800 leading-tight truncate" title={leader.name}>
                          {leader.name}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs font-bold text-slate-700">{leader.avg.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-slate-400">—</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alert Legend */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <span className="font-semibold">Alert trigger: </span>
          A red alert badge appears on any location that has received at least one review scoring
          <span className="font-semibold"> below 4 stars</span> in any category
          (Overall, Food, Service, Ambience, or Value).
          Click the badge to view the offending reviews. You can mark an alert as read — it only marks for your account. New reviews will re-trigger the alert automatically.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {visibleStats.map((stat) => {
          const isRead = isAlertRead(stat);
          const showAlert = stat.has_low_score && !isRead;
          const hasTrendData = stat.categoryTrends.some(t => t.direction !== null);
          return (
            <div
              key={stat.location_name}
              onClick={() => setSelectedLocation(stat.location_name)}
              className={`relative bg-white rounded-lg shadow-sm border-2 p-4 cursor-pointer transition-all ${
                selectedLocation === stat.location_name
                  ? 'border-slate-800 shadow-md'
                  : showAlert
                    ? 'border-red-300 hover:border-red-500'
                    : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              {showAlert && (
                <button
                  onClick={(e) => openAlertPopup(stat, e)}
                  className="absolute -top-2 -right-2 flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow hover:bg-red-700 transition-colors"
                  title={`Low scores in: ${stat.low_score_categories.join(', ')} — click to view`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>{stat.low_score_categories.length}</span>
                </button>
              )}
              {isRead && stat.has_low_score && (
                <div className="absolute -top-2 -right-2">
                  <div
                    className="flex items-center gap-1 bg-slate-400 text-white text-xs px-1.5 py-0.5 rounded-full shadow"
                    title="Marked as read by you"
                  >
                    <CheckCheck className="w-3 h-3" />
                  </div>
                </div>
              )}
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-slate-800 text-sm leading-tight pr-1">
                  {stat.location_name}
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs font-bold flex-shrink-0 ${getRatingColor(stat.avg_rating)}`}>
                  {stat.avg_rating.toFixed(1)}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <MessageSquare className="w-3 h-3" />
                  <span>{stat.review_count} reviews</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Calendar className="w-3 h-3" />
                  <span>Latest: {formatDate(stat.latest_review_date)}</span>
                </div>
                {showAlert && (
                  <div className="flex items-center gap-1 text-xs text-red-600 font-medium pt-0.5">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    <span>Low: {stat.low_score_categories.join(', ')}</span>
                  </div>
                )}
              </div>

              {hasTrendData && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-400 mb-1.5">30d vs prior 30d</div>
                  <div className="grid grid-cols-3 gap-1">
                    {stat.categoryTrends.filter(t => t.direction !== null).slice(0, 3).map(trend => (
                      <div key={trend.category} className="flex flex-col items-center">
                        <span className="text-xs text-slate-500">{trend.category.slice(0, 3)}</span>
                        <TrendIcon direction={trend.direction} delta={trend.delta} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Read alerts restore bar */}
      {dismissedAlerts.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-3 flex-wrap">
          <CheckCheck className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <span className="text-sm text-slate-600 font-medium">Marked as read:</span>
          {dismissedAlerts.map(s => (
            <button
              key={s.location_name}
              onClick={() => handleRestoreAlert(s.location_name, s.low_reviews.map(r => r.id))}
              className="text-xs bg-white border border-slate-300 text-slate-700 px-2 py-1 rounded-md hover:border-red-400 hover:text-red-600 transition-colors"
              title="Click to mark as unread"
            >
              {s.location_name} ↩
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedLocation('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedLocation === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Locations ({feedbacks.length})
          </button>
          {selectedLocation !== 'all' && (
            <div className="text-sm text-slate-600">
              Showing {filteredFeedbacks.length} reviews for <span className="font-semibold">{selectedLocation}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {filteredFeedbacks.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">No guest feedback available</p>
          </div>
        ) : (
          filteredFeedbacks.map((feedback) => (
            <div
              key={feedback.id}
              className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-slate-800">
                      {feedback.reviewer_name || 'Anonymous'}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSourceBadgeColor(feedback.review_source)}`}>
                      {feedback.review_source}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span className="font-medium">{feedback.location_name}</span>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {feedback.visit_date
                        ? `Visited ${formatDate(feedback.visit_date)}`
                        : `Reviewed ${formatDate(feedback.review_date)}`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {renderStars(feedback.overall_rating)}
                </div>
              </div>

              {feedback.review_text && (() => {
                const { cleanText, url } = extractReviewLink(feedback.review_text);
                return (
                  <div className="bg-slate-50 rounded-lg p-4 mb-4">
                    {cleanText && (
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap mb-3">
                        {cleanText}
                      </p>
                    )}
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition-colors"
                      >
                        View Full Review
                      </a>
                    )}
                  </div>
                );
              })()}

              {(feedback.food_rating || feedback.service_rating || feedback.ambience_rating || feedback.value_rating) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
                  {feedback.food_rating && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Food</div>
                      {renderStars(feedback.food_rating)}
                    </div>
                  )}
                  {feedback.service_rating && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Service</div>
                      {renderStars(feedback.service_rating)}
                    </div>
                  )}
                  {feedback.ambience_rating && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Ambience</div>
                      {renderStars(feedback.ambience_rating)}
                    </div>
                  )}
                  {feedback.value_rating && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Value</div>
                      {renderStars(feedback.value_rating)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Low-review alert popup */}
      {alertPopup && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setAlertPopup(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-lg">{alertPopup.location_name}</h2>
                  <p className="text-sm text-slate-500">
                    {alertPopup.low_reviews.length} review{alertPopup.low_reviews.length !== 1 ? 's' : ''} with scores below 4 stars
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleMarkAsRead(alertPopup.location_name, alertPopup.low_reviews.map(r => r.id), e)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Mark as read for your account only"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark as Read
                </button>
                <button
                  onClick={() => setAlertPopup(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {alertPopup.low_reviews.map((review) => (
                <div key={review.id} className="border border-red-200 bg-red-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800 text-sm">
                          {review.reviewer_name || 'Anonymous'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSourceBadgeColor(review.review_source)}`}>
                          {review.review_source}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {review.visit_date
                          ? `Visited ${formatDate(review.visit_date)}`
                          : `Reviewed ${formatDate(review.review_date)}`}
                      </div>
                    </div>
                    <div>{renderStars(review.overall_rating, true)}</div>
                  </div>

                  {review.review_text && (() => {
                    const { cleanText, url } = extractReviewLink(review.review_text);
                    return (
                      <div className="text-sm text-slate-700 bg-white rounded p-3 mb-3 leading-relaxed">
                        {cleanText && <p className="whitespace-pre-wrap mb-2">{cleanText}</p>}
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition-colors"
                          >
                            View Full Review
                          </a>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex flex-wrap gap-3">
                    {(['food_rating', 'service_rating', 'ambience_rating', 'value_rating'] as const).map((field) => {
                      const val = review[field];
                      if (!val) return null;
                      const label = field.replace('_rating', '').replace(/^\w/, c => c.toUpperCase());
                      const isLow = val < 4;
                      return (
                        <div key={field} className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${isLow ? 'bg-red-200 text-red-800' : 'bg-white text-slate-700'}`}>
                          <span>{label}:</span>
                          {renderStars(val, true)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
