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
  ChevronLeft,
  Edit2,
  Check,
  X,
  BookCheck
} from 'lucide-react';
import { activityApi, booksApi } from '../api';
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
 * Generate calendar grid cells for a given year and month (0-11).
 * Pads with days from the previous and next months to form a full 7-column grid.
 */
function generateMonthGrid(year, month, historyMap = new Map(), todayIso = new Date().toISOString().slice(0, 10)) {
  const firstDay = new Date(year, month, 1);
  const startingDayOfWeek = firstDay.getDay(); // 0 is Sunday
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days = [];

  // Padding days from previous month
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const dateObj = new Date(year, month - 1, dayNum);
    const iso = dateObj.toISOString().slice(0, 10);
    const data = historyMap.get(iso) || { total_pages: 0, total_seconds: 0, books_count: 0 };
    days.push({
      date: iso,
      dayNumber: dayNum,
      isCurrentMonth: false,
      pages: data.total_pages || 0,
      seconds: data.total_seconds || 0,
      isToday: iso === todayIso,
      isFuture: iso > todayIso,
    });
  }

  // Days in current month
  for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
    const dateObj = new Date(year, month, dayNum);
    const iso = dateObj.toISOString().slice(0, 10);
    const data = historyMap.get(iso) || { total_pages: 0, total_seconds: 0, books_count: 0 };
    days.push({
      date: iso,
      dayNumber: dayNum,
      isCurrentMonth: true,
      pages: data.total_pages || 0,
      seconds: data.total_seconds || 0,
      isToday: iso === todayIso,
      isFuture: iso > todayIso,
    });
  }

  // Padding days from next month to complete the row
  const remaining = (7 - (days.length % 7)) % 7;
  for (let dayNum = 1; dayNum <= remaining; dayNum++) {
    const dateObj = new Date(year, month + 1, dayNum);
    const iso = dateObj.toISOString().slice(0, 10);
    const data = historyMap.get(iso) || { total_pages: 0, total_seconds: 0, books_count: 0 };
    days.push({
      date: iso,
      dayNumber: dayNum,
      isCurrentMonth: false,
      pages: data.total_pages || 0,
      seconds: data.total_seconds || 0,
      isToday: iso === todayIso,
      isFuture: iso > todayIso,
    });
  }

  return days;
}

export default function ReadingActivityView({ onSelectBook, books = [] }) {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dayDetails, setDayDetails] = useState([]);
  const [dayLoading, setDayLoading] = useState(false);

  // Active Month View State
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Goal Editing State
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(10);
  const [savingGoal, setSavingGoal] = useState(false);

  const handleSelectBook = useCallback(async (b) => {
    if (!onSelectBook || !b) return;
    const bookId = b.id || b.book_id;
    if (!bookId) return;

    // 1. Try finding in loaded books list
    const found = books?.find((item) => item.id === bookId);
    if (found) {
      onSelectBook(found);
      return;
    }

    // 2. Try fetching full book details from API
    try {
      const full = await booksApi.getBook(bookId);
      if (full && (full.id || full.path || full.format)) {
        onSelectBook(full);
        return;
      }
    } catch (err) {
      console.warn('Failed to fetch book from API:', err);
    }

    // 3. Fallback to existing metadata
    onSelectBook({
      id: bookId,
      book_id: bookId,
      title: b.title,
      author: b.author,
      format: b.format,
      path: b.path,
      filename: b.filename,
      library_id: b.library_id,
      cover_url: b.cover_url || `/api/cover/${bookId}`,
    });
  }, [books, onSelectBook]);

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

  // Month navigation handlers
  const handlePrevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayStr);
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

  // Month title formatted to locale
  const monthTitle = useMemo(() => {
    const str = viewDate.toLocaleDateString(locale || 'default', { month: 'long', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }, [viewDate, locale]);

  const isCurrentMonthView = useMemo(() => {
    const now = new Date();
    return viewDate.getFullYear() === now.getFullYear() && viewDate.getMonth() === now.getMonth();
  }, [viewDate]);

  // 7-day week names (Sun..Sat)
  const weekDays = useMemo(() => {
    const baseSunday = new Date(2026, 10, 15); // Known Sunday
    const list = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseSunday);
      d.setDate(baseSunday.getDate() + i);
      const name = d.toLocaleDateString(locale || 'default', { weekday: 'short' });
      list.push(name.charAt(0).toUpperCase() + name.slice(1));
    }
    return list;
  }, [locale]);

  // Days grid for the viewed month
  const monthDays = useMemo(() => {
    return generateMonthGrid(viewDate.getFullYear(), viewDate.getMonth(), historyMap, todayStr);
  }, [viewDate, historyMap, todayStr]);

  // Statistics for the active month
  const monthStats = useMemo(() => {
    let pages = 0;
    let seconds = 0;
    let activeDays = 0;
    monthDays.forEach((d) => {
      if (d.isCurrentMonth && d.pages > 0) {
        pages += d.pages;
        seconds += d.seconds;
        activeDays += 1;
      }
    });
    return { pages, seconds, activeDays };
  }, [monthDays]);

  if (loading && !stats) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
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
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight flex items-center gap-3">
            <span className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Flame className="w-7 h-7 fill-orange-500 text-orange-500 animate-pulse" />
            </span>
            <span>{t('activity') || 'Atividade'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1.5">
            {t('keepReadingPrompt') || 'Leia no seu próprio ritmo — o progresso é registrado automaticamente pelo conteúdo de cada página!'}
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
            <span className="text-xs font-bold uppercase tracking-wider text-orange-400/90 flex items-center gap-1.5">
              <Flame className="w-4 h-4 fill-orange-400 text-orange-400" />
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
                ? (t('consecutiveDays_one') || 'dia consecutivo')
                : (t('consecutiveDays') || 'dias consecutivos')}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center gap-2 text-xs text-neutral-400">
            {pagesToday > 0 ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                {t('streakActiveToday') || 'Ofensiva mantida hoje!'}
              </span>
            ) : (
              <span className="text-orange-400/90">
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
                pagesToday >= dailyGoal ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-orange-500'
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

      {/* Monthly Activity Calendar Grid */}
      <div className="rounded-2xl bg-neutral-900/80 border border-neutral-800 p-4 sm:p-6 shadow-xl space-y-4">
        {/* Calendar Header with Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Calendar className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-100">
                {t('monthlyActivity') || 'Atividade Mensal'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                <span>{monthStats.pages} {t('pages') || 'páginas'}</span>
                <span>•</span>
                <span>{monthStats.activeDays} {t('totalReadingDays') || 'dias lendo'}</span>
                {monthStats.seconds > 0 && (
                  <>
                    <span>•</span>
                    <span>{formatTime(monthStats.seconds)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Month Switcher Controls */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
            {!isCurrentMonthView && (
              <button
                type="button"
                onClick={handleGoToToday}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
              >
                {t('today') || 'Hoje'}
              </button>
            )}

            <div className="flex items-center gap-1 bg-neutral-950/80 p-1 rounded-xl border border-neutral-800">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
                title={t('prevMonth') || 'Mês anterior'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs sm:text-sm font-bold text-neutral-200 px-3 min-w-[120px] text-center">
                {monthTitle}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
                title={t('nextMonth') || 'Próximo mês'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 7-Column Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[11px] sm:text-xs font-semibold text-neutral-400 pt-1">
          {weekDays.map((wd, idx) => (
            <div key={idx} className="py-1">
              {wd}
            </div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {monthDays.map((day) => {
            const isSelected = selectedDate === day.date;
            const goalMet = day.pages >= dailyGoal;

            return (
              <button
                key={day.date}
                type="button"
                disabled={day.isFuture}
                onClick={() => setSelectedDate(day.date)}
                className={`
                  relative flex flex-col justify-between p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer text-left
                  min-h-[52px] sm:min-h-[66px]
                  ${isSelected
                    ? 'ring-2 ring-orange-400 border-orange-400 bg-neutral-900 shadow-xl scale-[1.02] z-10'
                    : goalMet
                    ? 'bg-orange-500/15 border border-orange-500/35 hover:border-orange-400 hover:bg-orange-500/20'
                    : day.pages > 0
                    ? 'bg-amber-950/25 border border-amber-800/35 hover:border-amber-700 hover:bg-amber-900/30'
                    : day.isCurrentMonth
                    ? 'bg-neutral-950/60 border border-neutral-800/60 hover:border-neutral-700 hover:bg-neutral-900'
                    : 'bg-neutral-950/20 border border-neutral-900/40 opacity-30'}
                  ${day.isFuture ? 'opacity-20 pointer-events-none cursor-default' : ''}
                `}
              >
                {/* Day Number & Flame Icon Header */}
                <div className="flex items-center justify-between w-full">
                  <span className={`
                    text-xs sm:text-sm font-bold
                    ${day.isToday
                      ? 'w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full bg-orange-500 text-neutral-950 font-black'
                      : day.isCurrentMonth ? 'text-neutral-200' : 'text-neutral-600'}
                  `}>
                    {day.dayNumber}
                  </span>

                  {goalMet && (
                    <Flame className="w-3.5 h-3.5 fill-orange-400 text-orange-400 shrink-0" />
                  )}
                </div>

                {/* Pages Read Badge */}
                {day.pages > 0 ? (
                  <div className="mt-1 flex items-center">
                    <span className={`
                      inline-flex items-center text-[10px] sm:text-xs font-semibold px-1 sm:px-1.5 py-0.5 rounded leading-none
                      ${goalMet
                        ? 'bg-orange-500/20 text-orange-300 font-bold'
                        : 'bg-neutral-800 text-amber-300'}
                    `}>
                      <span>{day.pages}</span>
                      <span className="text-[9px] sm:text-[10px] font-normal ml-0.5 opacity-80">
                        {t('pagesShort') || 'p'}
                      </span>
                    </span>
                  </div>
                ) : (
                  <div className="h-3" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400 flex-wrap gap-2">
          <span className="text-[11px] text-neutral-400">
            {t('clickDayToInspect') || 'Clique em qualquer dia para ver os detalhes da leitura'}
          </span>
          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-950/40 border border-amber-800/40" />
              <span>{t('readingDay') || 'Com leitura'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-orange-500/25 border border-orange-500/40" />
              <span className="flex items-center gap-1">
                <Flame className="w-3 h-3 fill-orange-400 text-orange-400" />
                {t('goalMet') || 'Meta batida'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Day Activity Log */}
      <div className="rounded-2xl bg-neutral-900/80 border border-neutral-800 p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Calendar className="w-5 h-5 text-orange-400" />
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
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
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
                onClick={() => handleSelectBook(b)}
                className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 hover:border-orange-500/40 hover:bg-neutral-800/40 transition flex items-center justify-between group cursor-pointer"
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    {b.format && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                        {b.format}
                      </span>
                    )}
                    <h4 className="text-xs sm:text-sm font-semibold text-neutral-200 truncate group-hover:text-orange-300 transition-colors">
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

                <div className="p-1.5 rounded-lg bg-neutral-900 text-neutral-400 group-hover:text-orange-400 group-hover:bg-orange-500/10 transition shrink-0">
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
                onClick={() => handleSelectBook(cb)}
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
