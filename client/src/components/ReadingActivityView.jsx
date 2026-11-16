import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Flame,
  Target,
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  Trophy,
  ChevronRight,
  Edit2,
  Check,
  X,
  BookCheck
} from 'lucide-react';
import { activityApi } from '../api';
import { useI18n } from '../i18n';

/**
 * Format minutes into readable Xh Ym or Xm string.
 */
function formatTime(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0m';
  const totalMin = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Generate 52 weeks (364/371 days) matrix ending on current week.
 */
function generateHeatmapCalendar(historyMap = new Map(), todayIso = new Date().toISOString().slice(0, 10)) {
  const today = new Date(todayIso + 'T00:00:00');
  
  // Align end to Saturday of the current week (or Sunday)
  const currentDayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
  const endOffset = 6 - currentDayOfWeek;
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + endOffset);

  // 52 weeks = 52 * 7 = 364 days
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - (52 * 7 - 1));

  const weeks = [];
  let currentWeek = [];
  const cur = new Date(startDate);

  while (cur <= endDate) {
    const iso = cur.toISOString().slice(0, 10);
    const dayData = historyMap.get(iso) || { total_pages: 0, total_seconds: 0, books_count: 0 };
    const isFuture = cur > today;

    currentWeek.push({
      date: iso,
      dayOfWeek: cur.getDay(),
      dayOfMonth: cur.getDate(),
      month: cur.getMonth(),
      pages: dayData.total_pages || 0,
      seconds: dayData.total_seconds || 0,
      booksCount: dayData.books_count || 0,
      isToday: iso === todayIso,
      isFuture,
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    cur.setDate(cur.getDate() + 1);
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return weeks;
}

export default function ReadingActivityView({ onSelectBook }) {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dayDetails, setDayDetails] = useState([]);
  const [dayLoading, setDayLoading] = useState(false);

  // Goal Editing State
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(10);
  const [savingGoal, setSavingGoal] = useState(false);

  // Fetch overview data
  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const data = await activityApi.getOverview(365, todayStr);
      if (data && data.status === 'ok') {
        setStats(data.stats);
        setHistory(data.history || []);
        setGoalInput(data.stats.daily_goal || 10);
      }
    } catch (err) {
      console.error('[ReadingActivityView] Failed to load overview:', err);
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Fetch details for selected date
  const loadDayDetails = useCallback(async (date) => {
    try {
      setDayLoading(true);
      const data = await activityApi.getDayDetails(date);
      if (data && data.status === 'ok') {
        setDayDetails(data.books || []);
      } else {
        setDayDetails([]);
      }
    } catch (err) {
      console.warn('[ReadingActivityView] Failed to load day details:', err);
      setDayDetails([]);
    } finally {
      setDayLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadDayDetails(selectedDate);
    }
  }, [selectedDate, loadDayDetails]);

  // Handle saving daily goal
  const handleSaveGoal = async () => {
    const val = parseInt(goalInput, 10);
    if (isNaN(val) || val <= 0) return;
    try {
      setSavingGoal(true);
      const res = await activityApi.setDailyGoal(val);
      if (res && res.status === 'ok') {
        setStats(prev => prev ? {
          ...prev,
          daily_goal: res.daily_pages_goal,
          goal_met_today: prev.pages_today >= res.daily_pages_goal,
        } : null);
        setIsEditingGoal(false);
      }
    } catch (e) {
      console.error('[ReadingActivityView] Error saving goal:', e);
    } finally {
      setSavingGoal(false);
    }
  };

  // Map history array by date string for O(1) lookup
  const historyMap = useMemo(() => {
    const map = new Map();
    for (const h of history) {
      map.set(h.date, h);
    }
    return map;
  }, [history]);

  const dailyGoal = stats?.daily_goal || 10;
  const weeks = useMemo(() => generateHeatmapCalendar(historyMap, todayStr), [historyMap, todayStr]);

  // Calculate cell color based on pages read and daily goal
  const getCellColor = (day) => {
    if (day.isFuture) return 'bg-transparent border-transparent cursor-default pointer-events-none opacity-20';
    if (day.pages === 0) {
      return 'bg-neutral-900/90 border border-neutral-800/60 hover:border-neutral-700';
    }
    if (day.pages >= dailyGoal) {
      return 'bg-amber-500 border border-amber-400 shadow-sm shadow-amber-500/30 text-neutral-950 font-bold hover:brightness-110';
    }
    if (day.pages >= Math.ceil(dailyGoal / 2)) {
      return 'bg-amber-600/70 border border-amber-500/60 hover:brightness-110';
    }
    return 'bg-amber-900/50 border border-amber-800/40 hover:brightness-110';
  };

  // Month labels across columns
  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    weeks.forEach((week, wIndex) => {
      const firstValidDay = week.find(d => !d.isFuture);
      if (firstValidDay && firstValidDay.month !== lastMonth) {
        lastMonth = firstValidDay.month;
        const dObj = new Date(firstValidDay.date + 'T00:00:00');
        const monthName = dObj.toLocaleDateString(locale || 'default', { month: 'short' });
        labels.push({ colIndex: wIndex, label: monthName });
      }
    });
    return labels;
  }, [weeks, locale]);

  if (loading && !stats) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-neutral-400 font-medium">{t('loading')}...</span>
      </div>
    );
  }

  const pagesToday = stats?.pages_today || 0;
  const currentStreak = stats?.current_streak || 0;
  const bestStreak = stats?.best_streak || 0;
  const totalPages = stats?.total_pages || 0;
  const totalSeconds = stats?.total_seconds || 0;
  const totalDays = stats?.total_days || 0;
  const goalProgressPct = Math.min(100, Math.round((pagesToday / dailyGoal) * 100));
  const completedBooks = stats?.completed_books || [];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Flame className="w-7 h-7 fill-amber-500 text-amber-500 animate-pulse" />
            </span>
            <span>{t('readingActivity') || 'Atividade de Leitura'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1.5">
            {t('keepReadingPrompt') || 'Leia por ao menos 15s em cada página para registrar seu progresso diário!'}
          </p>
        </div>

        {/* Total Time & Days Stats Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3.5 py-1.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-neutral-400" />
            <span className="text-xs font-semibold text-neutral-200">{formatTime(totalSeconds)}</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-neutral-400" />
            <span className="text-xs font-semibold text-neutral-200">{totalDays} {t('totalReadingDays') || 'dias lendo'}</span>
          </div>
        </div>
      </div>

      {/* Top 3 Metric Cards: Streak, Goal, Total Pages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Streak */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900/90 to-neutral-950 p-6 border border-neutral-800/80 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
              <Flame className="w-4 h-4 fill-amber-400 text-amber-400" />
              {t('currentStreak') || 'Ofensiva Atual'}
            </span>
            <span className="text-[11px] font-medium text-neutral-400 px-2 py-0.5 rounded-full bg-neutral-800/80">
              {t('bestStreak', { count: bestStreak }) || `Recorde: ${bestStreak} dias`}
            </span>
          </div>
          
          <div className="flex items-baseline gap-3 my-2">
            <span className="text-5xl font-black text-neutral-100 tracking-tight">
              {currentStreak}
            </span>
            <span className="text-sm font-semibold text-neutral-400">
              {currentStreak === 1
                ? (t('streakDays_one') || 'dia consecutivo')
                : (t('streakDays', { count: currentStreak }) || 'dias consecutivos')}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center gap-2 text-xs text-neutral-400">
            {pagesToday > 0 ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                {t('streakActiveToday') || 'Ofensiva mantida hoje!'}
              </span>
            ) : (
              <span className="text-amber-400/90">
                {t('streakPendingToday') || 'Leia hoje para manter sua ofensiva!'}
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Daily Goal */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900/90 to-neutral-950 p-6 border border-neutral-800/80 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400/90 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-400" />
              {t('dailyGoal') || 'Meta Diária'}
            </span>

            {!isEditingGoal ? (
              <button
                onClick={() => setIsEditingGoal(true)}
                className="text-[11px] font-medium text-neutral-400 hover:text-neutral-200 flex items-center gap-1 transition px-2 py-0.5 rounded-md hover:bg-neutral-800 cursor-pointer"
                title={t('editGoal') || 'Ajustar Meta'}
              >
                <Edit2 className="w-3 h-3" />
                <span>{dailyGoal} pág/dia</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="w-14 px-1.5 py-0.5 text-xs bg-neutral-800 border border-neutral-700 rounded text-center text-neutral-100 font-bold focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={handleSaveGoal}
                  disabled={savingGoal}
                  className="p-1 rounded bg-amber-500 text-neutral-950 hover:bg-amber-400 cursor-pointer transition disabled:opacity-50"
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </button>
                <button
                  onClick={() => {
                    setIsEditingGoal(false);
                    setGoalInput(dailyGoal);
                  }}
                  className="p-1 rounded bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-baseline justify-between my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-neutral-100 tracking-tight">
                {pagesToday}
              </span>
              <span className="text-sm font-semibold text-neutral-400">
                / {dailyGoal} {t('pages') || 'págs hoje'}
              </span>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              pagesToday >= dailyGoal
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-neutral-800 text-neutral-400'
            }`}>
              {pagesToday >= dailyGoal ? (t('goalAchieved') || 'Meta Batida!') : `${goalProgressPct}%`}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 w-full bg-neutral-800/80 rounded-full h-2.5 overflow-hidden border border-neutral-700/50">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                pagesToday >= dailyGoal ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-amber-500'
              }`}
              style={{ width: `${goalProgressPct}%` }}
            />
          </div>
        </div>

        {/* Card 3: All-Time Pages */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900/90 to-neutral-950 p-6 border border-neutral-800/80 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400/90 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-teal-400" />
              {t('totalPagesRead') || 'Total de Páginas'}
            </span>
            <span className="text-[11px] font-medium text-neutral-400 px-2 py-0.5 rounded-full bg-neutral-800/80">
              {completedBooks.length} {t('completedBooks') || 'lidos'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-2">
            <span className="text-5xl font-black text-neutral-100 tracking-tight">
              {totalPages.toLocaleString()}
            </span>
            <span className="text-sm font-semibold text-neutral-400">
              {t('pages') || 'páginas no total'}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between text-xs text-neutral-400">
            <span>{t('averagePerDay') || 'Média diária'}:</span>
            <span className="font-semibold text-neutral-200">
              {totalDays > 0 ? (totalPages / totalDays).toFixed(1) : '0'} págs/dia
            </span>
          </div>
        </div>
      </div>

      {/* Continuous Activity Heatmap (Grade de 52 Semanas) */}
      <div className="rounded-2xl bg-neutral-900/80 border border-neutral-800 p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-bold text-neutral-100">
              {t('activityHeatmap') || 'Grade de Atividade Contínua (Último Ano)'}
            </h2>
          </div>
          <span className="text-xs text-neutral-400 font-medium">
            {history.length} {t('daysWithActivity') || 'dias com leitura registrada'}
          </span>
        </div>

        {/* Heatmap Grid Container with Horizontal Scroll on Small Screens */}
        <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-800">
          <div className="min-w-[760px]">
            {/* Months Row */}
            <div className="flex text-[11px] font-semibold text-neutral-400 pl-8 mb-2 h-4 relative">
              {monthLabels.map((m, idx) => (
                <div
                  key={idx}
                  className="absolute"
                  style={{ left: `${32 + m.colIndex * 14}px` }}
                >
                  {m.label}
                </div>
              ))}
            </div>

            {/* Grid Matrix: 7 rows x 52 columns */}
            <div className="flex gap-1.5 items-start">
              {/* Day-of-week labels */}
              <div className="flex flex-col justify-between h-[106px] text-[10px] font-medium text-neutral-500 w-6 shrink-0 pt-0.5">
                <span>Dom</span>
                <span>Ter</span>
                <span>Qui</span>
                <span>Sáb</span>
              </div>

              {/* Columns of weeks */}
              <div className="flex gap-1 flex-1">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1">
                    {week.map((day) => {
                      const isSelected = selectedDate === day.date;
                      return (
                        <button
                          key={day.date}
                          type="button"
                          onClick={() => !day.isFuture && setSelectedDate(day.date)}
                          title={`${day.date}: ${day.pages} pág(s) ${day.seconds > 0 ? `(${formatTime(day.seconds)})` : ''}`}
                          className={`
                            w-3 h-3 rounded-[3px] transition-all cursor-pointer relative
                            ${getCellColor(day)}
                            ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-neutral-950 scale-125 z-10' : ''}
                          `}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap Legend */}
            <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
              <span className="text-[11px] text-neutral-400">
                {t('clickDayToInspect') || 'Clique em qualquer quadrado para ver os detalhes daquele dia'}
              </span>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span>{t('less') || 'Menos'}</span>
                <span className="w-3 h-3 rounded-[3px] bg-neutral-900 border border-neutral-800" />
                <span className="w-3 h-3 rounded-[3px] bg-amber-900/50 border border-amber-800/40" />
                <span className="w-3 h-3 rounded-[3px] bg-amber-600/70 border border-amber-500/60" />
                <span className="w-3 h-3 rounded-[3px] bg-amber-500 border border-amber-400" />
                <span>{t('more') || 'Mais'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Day Activity Log */}
      <div className="rounded-2xl bg-neutral-900/80 border border-neutral-800 p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Calendar className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100">
                {selectedDate === todayStr ? (t('today') || 'Hoje') : selectedDate}
              </h3>
              <span className="text-xs text-neutral-400">
                {dayDetails.reduce((acc, b) => acc + (b.pages_read || 0), 0)} {t('pagesReadTotal') || 'páginas registradas'}
              </span>
            </div>
          </div>
        </div>

        {dayLoading ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : dayDetails.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-400 flex flex-col items-center justify-center gap-1">
            <BookOpen className="w-6 h-6 text-neutral-400 opacity-60 mb-1" />
            <span>{t('noActivityOnDay') || 'Nenhuma página registrada neste dia.'}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {dayDetails.map((b) => (
              <div
                key={b.book_id}
                onClick={() => onSelectBook && onSelectBook({ id: b.book_id, title: b.title })}
                className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 hover:border-amber-500/40 hover:bg-neutral-800/40 transition flex items-center justify-between group cursor-pointer"
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    {b.format && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {b.format}
                      </span>
                    )}
                    <h4 className="text-xs sm:text-sm font-semibold text-neutral-200 truncate group-hover:text-amber-300 transition-colors">
                      {b.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                    <span>{b.pages_read} {b.pages_read === 1 ? 'página' : 'páginas'}</span>
                    {b.reading_time_seconds > 0 && (
                      <>
                        <span>•</span>
                        <span>{formatTime(b.reading_time_seconds)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-1.5 rounded-lg bg-neutral-900 text-neutral-400 group-hover:text-amber-400 group-hover:bg-amber-500/10 transition shrink-0">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Books Section */}
      {completedBooks.length > 0 && (
        <div className="rounded-2xl bg-neutral-900/80 border border-neutral-800 p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-neutral-800">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-neutral-100">
              {t('completedBooks') || 'Livros Concluídos'} ({completedBooks.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {completedBooks.map((cb) => (
              <div
                key={cb.id}
                onClick={() => onSelectBook && onSelectBook(cb)}
                className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 hover:border-teal-500/40 hover:bg-neutral-800/40 transition flex items-center gap-3 group cursor-pointer"
              >
                <div className="w-10 h-14 bg-neutral-800 rounded-md overflow-hidden shrink-0 flex items-center justify-center border border-neutral-700">
                  {cb.cover_url ? (
                    <img src={cb.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <BookCheck className="w-5 h-5 text-teal-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-neutral-200 truncate group-hover:text-teal-300 transition-colors">
                    {cb.title}
                  </h4>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    {cb.author || '—'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{t('finished') || 'Concluído'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
