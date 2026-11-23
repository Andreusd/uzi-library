import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import {
  useReadingTracker,
  flushOfflineActivityQueue,
  calculateRequiredDwellSeconds,
} from '../hooks/useReadingTracker';
import ReadingActivityView from '../components/ReadingActivityView';
import { activityApi, booksApi } from '../api';
import { I18nProvider } from '../i18n';

// Helper component to test useReadingTracker
function TrackerTestComponent({
  bookId,
  currentPage,
  totalPages,
  enabled = true,
  isDualPage = false,
  spread = null,
  getText = null,
}) {
  useReadingTracker({ bookId, currentPage, totalPages, enabled, isDualPage, spread, getText });
  return <div data-testid="tracker-active">Page {currentPage}</div>;
}

describe('Reading Activity Tracking & Dynamic Character-based Dwell Time', () => {
  describe('calculateRequiredDwellSeconds formula', () => {
    it('returns empty page floor (5s) for empty or null text', () => {
      expect(calculateRequiredDwellSeconds(0)).toBe(5);
      expect(calculateRequiredDwellSeconds(null)).toBe(5);
      expect(calculateRequiredDwellSeconds(-10)).toBe(5);
    });

    it('clamps to minimum floor (3s) for very short text', () => {
      // 50 chars / 30 = ~1.6s -> clamped to 3s
      expect(calculateRequiredDwellSeconds(50)).toBe(3);
    });

    it('calculates proportional time at 30 chars/second', () => {
      // 300 chars / 30 = 10s
      expect(calculateRequiredDwellSeconds(300)).toBe(10);
      // 600 chars / 30 = 20s
      expect(calculateRequiredDwellSeconds(600)).toBe(20);
      // 1200 chars / 30 = 40s
      expect(calculateRequiredDwellSeconds(1200)).toBe(40);
    });

    it('caps maximum required dwell time at 45 seconds for dense pages', () => {
      // 2400 chars / 30 = 80s -> capped at 45s
      expect(calculateRequiredDwellSeconds(2400)).toBe(45);
      expect(calculateRequiredDwellSeconds(5000)).toBe(45);
    });
  });

  describe('useReadingTracker hook with dynamic character count', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
      localStorage.clear();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
      localStorage.clear();
    });

    it('records activity for a short page (60 chars) after only 3 seconds', async () => {
      const recordSpy = vi.spyOn(activityApi, 'recordActivity').mockResolvedValue({ status: 'ok' });
      const getText = vi.fn().mockReturnValue('A'.repeat(60)); // 60 chars -> 3s required

      const { rerender } = render(
        <TrackerTestComponent bookId="book-short" currentPage={1} totalPages={100} getText={getText} />
      );

      // Advance by 3 seconds
      act(() => {
        vi.advanceTimersByTime(3500);
      });

      rerender(
        <TrackerTestComponent bookId="book-short" currentPage={2} totalPages={100} getText={getText} />
      );

      expect(recordSpy).toHaveBeenCalledTimes(1);
      const payload = recordSpy.mock.calls[0][0];
      expect(payload.book_id).toBe('book-short');
      expect(payload.pages).toEqual([1]);
      expect(payload.reading_time_seconds).toBeGreaterThanOrEqual(3);
    });

    it('does not record a dense page (600 chars) if user advances after only 10s (needs 20s)', async () => {
      const recordSpy = vi.spyOn(activityApi, 'recordActivity').mockResolvedValue({ status: 'ok' });
      const getText = vi.fn().mockReturnValue('A'.repeat(600)); // 600 chars -> 20s required

      const { rerender } = render(
        <TrackerTestComponent bookId="book-dense" currentPage={1} totalPages={100} getText={getText} />
      );

      // Advance by 10 seconds (under required 20s)
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      rerender(
        <TrackerTestComponent bookId="book-dense" currentPage={2} totalPages={100} getText={getText} />
      );

      expect(recordSpy).not.toHaveBeenCalled();
    });

    it('records dense page (600 chars) when user spends 22s and advances', async () => {
      const recordSpy = vi.spyOn(activityApi, 'recordActivity').mockResolvedValue({ status: 'ok' });
      const getText = vi.fn().mockReturnValue('A'.repeat(600)); // 600 chars -> 20s required

      const { rerender } = render(
        <TrackerTestComponent bookId="book-dense" currentPage={1} totalPages={100} getText={getText} />
      );

      // Advance by 22 seconds (>= 20s)
      act(() => {
        vi.advanceTimersByTime(22000);
      });

      rerender(
        <TrackerTestComponent bookId="book-dense" currentPage={2} totalPages={100} getText={getText} />
      );

      expect(recordSpy).toHaveBeenCalledTimes(1);
      const payload = recordSpy.mock.calls[0][0];
      expect(payload.pages).toEqual([1]);
      expect(payload.reading_time_seconds).toBe(22);
    });

    it('works with asynchronous getText (Promise resolution like PDF.js)', async () => {
      const recordSpy = vi.spyOn(activityApi, 'recordActivity').mockResolvedValue({ status: 'ok' });
      const getText = vi.fn().mockImplementation(() => Promise.resolve('B'.repeat(300))); // 300 chars -> 10s required

      const { rerender } = render(
        <TrackerTestComponent bookId="book-async" currentPage={1} totalPages={100} getText={getText} />
      );

      // Flush microtask for Promise resolution
      await act(async () => {
        await Promise.resolve();
      });

      // Advance by 12 seconds
      act(() => {
        vi.advanceTimersByTime(12000);
      });

      rerender(
        <TrackerTestComponent bookId="book-async" currentPage={2} totalPages={100} getText={getText} />
      );

      expect(recordSpy).toHaveBeenCalledTimes(1);
      const payload = recordSpy.mock.calls[0][0];
      expect(payload.book_id).toBe('book-async');
      expect(payload.pages).toEqual([1]);
      expect(payload.reading_time_seconds).toBe(12);
    });

    it('records both pages in dual-page spread mode', async () => {
      const recordSpy = vi.spyOn(activityApi, 'recordActivity').mockResolvedValue({ status: 'ok' });

      const { rerender } = render(
        <TrackerTestComponent
          bookId="book-pdf"
          currentPage={2}
          totalPages={50}
          isDualPage={true}
          spread={{ left: 2, right: 3 }}
        />
      );

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      rerender(
        <TrackerTestComponent
          bookId="book-pdf"
          currentPage={4}
          totalPages={50}
          isDualPage={true}
          spread={{ left: 4, right: 5 }}
        />
      );

      expect(recordSpy).toHaveBeenCalledTimes(1);
      const payload = recordSpy.mock.calls[0][0];
      expect(payload.pages).toEqual([2, 3]);
    });

    it('queues offline records when API fails and flushes when online', async () => {
      vi.spyOn(activityApi, 'recordActivity').mockRejectedValue(new Error('Network error'));

      const { rerender } = render(
        <TrackerTestComponent bookId="book-offline" currentPage={5} totalPages={100} />
      );

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      rerender(
        <TrackerTestComponent bookId="book-offline" currentPage={6} totalPages={100} />
      );

      await act(async () => {
        await Promise.resolve();
      });

      const queuedRaw = localStorage.getItem('uzi_offline_activity_queue');
      expect(queuedRaw).toBeTruthy();
      const queued = JSON.parse(queuedRaw);
      expect(queued.length).toBe(1);
      expect(queued[0].book_id).toBe('book-offline');
      expect(queued[0].pages).toEqual([5]);

      const successSpy = vi.spyOn(activityApi, 'recordActivity').mockResolvedValue({ status: 'ok' });
      successSpy.mockClear();
      await flushOfflineActivityQueue();

      expect(successSpy).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('uzi_offline_activity_queue')).toBeNull();
    });
  });

  describe('ReadingActivityView component', () => {
    it('renders metrics cards with streak, daily goal progress, and heatmap', async () => {
      vi.spyOn(activityApi, 'getOverview').mockResolvedValue({
        status: 'ok',
        stats: {
          current_streak: 5,
          best_streak: 12,
          total_pages: 350,
          total_seconds: 14400,
          total_days: 18,
          pages_today: 15,
          daily_goal: 10,
          goal_met_today: true,
          completed_books: [
            { id: 'b-done', title: 'Finished Book', author: 'Author X', cover_url: '' }
          ],
        },
        history: [
          { date: new Date().toISOString().slice(0, 10), total_pages: 15, total_seconds: 600, books_count: 1 }
        ]
      });

      vi.spyOn(activityApi, 'getDayDetails').mockResolvedValue({
        status: 'ok',
        date: new Date().toISOString().slice(0, 10),
        books: [
          { book_id: 'b-1', title: 'Dune', pages_read: 15, reading_time_seconds: 600, format: 'epub' }
        ]
      });

      render(
        <I18nProvider>
          <ReadingActivityView onSelectBook={vi.fn()} />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('350')).toBeInTheDocument();
      });

      expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);

      expect(screen.getByText(/Meta Batida|Goal Achieved/i)).toBeInTheDocument();
      expect(screen.getByText('350')).toBeInTheDocument();
      expect(screen.getByText('Finished Book')).toBeInTheDocument();
      expect(screen.getByText('Dune')).toBeInTheDocument();
    });

    it('allows updating the daily reading goal', async () => {
      vi.spyOn(activityApi, 'getOverview').mockResolvedValue({
        status: 'ok',
        stats: {
          current_streak: 3,
          best_streak: 5,
          total_pages: 100,
          total_seconds: 3600,
          total_days: 4,
          pages_today: 5,
          daily_goal: 10,
          goal_met_today: false,
          completed_books: [],
        },
        history: []
      });

      vi.spyOn(activityApi, 'getDayDetails').mockResolvedValue({
        status: 'ok',
        date: new Date().toISOString().slice(0, 10),
        books: []
      });

      const setGoalSpy = vi.spyOn(activityApi, 'setDailyGoal').mockResolvedValue({
        status: 'ok',
        daily_pages_goal: 20
      });

      render(
        <I18nProvider>
          <ReadingActivityView onSelectBook={vi.fn()} />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/10 (pages\/day|pág\/dia)/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/10 (pages\/day|pág\/dia)/i));

      const input = screen.getByDisplayValue('10');
      fireEvent.change(input, { target: { value: '20' } });

      const checkBtn = input.nextElementSibling;
      fireEvent.click(checkBtn);

      await waitFor(() => {
        expect(setGoalSpy).toHaveBeenCalledWith(20);
      });
    });

    it('resolves full book object from books prop when clicking a book card in day activity', async () => {
      const onSelectBook = vi.fn();
      const mockBooks = [
        { id: 'b-1', title: 'Dune', format: 'epub', path: '/books/dune.epub', library_id: 'lib-1' }
      ];

      vi.spyOn(activityApi, 'getOverview').mockResolvedValue({
        status: 'ok',
        stats: {
          current_streak: 2,
          best_streak: 5,
          total_pages: 50,
          total_seconds: 1000,
          total_days: 3,
          pages_today: 10,
          daily_goal: 10,
          goal_met_today: true,
          completed_books: []
        },
        history: []
      });

      vi.spyOn(activityApi, 'getDayDetails').mockResolvedValue({
        status: 'ok',
        date: new Date().toISOString().slice(0, 10),
        books: [
          { book_id: 'b-1', title: 'Dune', pages_read: 10, reading_time_seconds: 300, format: 'epub' }
        ]
      });

      render(
        <I18nProvider>
          <ReadingActivityView onSelectBook={onSelectBook} books={mockBooks} />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Dune')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Dune'));

      await waitFor(() => {
        expect(onSelectBook).toHaveBeenCalledWith(mockBooks[0]);
      });
    });

    it('fetches full book details via booksApi.getBook if book is not in books prop', async () => {
      const onSelectBook = vi.fn();
      const fetchedBook = { id: 'b-2', title: 'Foundation', format: 'epub', path: '/books/foundation.epub' };
      const getBookSpy = vi.spyOn(booksApi, 'getBook').mockResolvedValue(fetchedBook);

      vi.spyOn(activityApi, 'getOverview').mockResolvedValue({
        status: 'ok',
        stats: {
          current_streak: 1,
          best_streak: 1,
          total_pages: 5,
          total_seconds: 120,
          total_days: 1,
          pages_today: 5,
          daily_goal: 10,
          goal_met_today: false,
          completed_books: []
        },
        history: []
      });

      vi.spyOn(activityApi, 'getDayDetails').mockResolvedValue({
        status: 'ok',
        date: new Date().toISOString().slice(0, 10),
        books: [
          { book_id: 'b-2', title: 'Foundation', pages_read: 5, reading_time_seconds: 120, format: 'epub' }
        ]
      });

      render(
        <I18nProvider>
          <ReadingActivityView onSelectBook={onSelectBook} books={[]} />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Foundation')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Foundation'));

      await waitFor(() => {
        expect(getBookSpy).toHaveBeenCalledWith('b-2');
        expect(onSelectBook).toHaveBeenCalledWith(fetchedBook);
      });
    });
  });
});
