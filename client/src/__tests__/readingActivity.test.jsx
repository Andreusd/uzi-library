import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useReadingTracker, flushOfflineActivityQueue } from '../hooks/useReadingTracker';
import ReadingActivityView from '../components/ReadingActivityView';
import { activityApi } from '../api';
import { I18nProvider } from '../i18n';

// Helper component to test useReadingTracker
function TrackerTestComponent({ bookId, currentPage, totalPages, enabled = true, isDualPage = false, spread = null }) {
  useReadingTracker({ bookId, currentPage, totalPages, enabled, isDualPage, spread });
  return <div data-testid="tracker-active">Page {currentPage}</div>;
}

describe('Reading Activity Tracking & Visualization', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('useReadingTracker hook', () => {
    it('does not record activity if dwell time is under 15 seconds', async () => {
      const recordSpy = vi.spyOn(activityApi, 'recordActivity').mockResolvedValue({ status: 'ok' });

      const { rerender } = render(
        <TrackerTestComponent bookId="book-1" currentPage={1} totalPages={100} />
      );

      // Fast forward 10 seconds (less than 15s threshold)
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Change page to 2
      rerender(
        <TrackerTestComponent bookId="book-1" currentPage={2} totalPages={100} />
      );

      expect(recordSpy).not.toHaveBeenCalled();
    });

    it('records page activity when user spends at least 15 seconds on a page and advances', async () => {
      const recordSpy = vi.spyOn(activityApi, 'recordActivity').mockResolvedValue({ status: 'ok' });

      const { rerender } = render(
        <TrackerTestComponent bookId="book-1" currentPage={1} totalPages={100} />
      );

      // Advance by 20 seconds (>= 15s)
      act(() => {
        vi.advanceTimersByTime(20000);
      });

      // Change page to 2
      rerender(
        <TrackerTestComponent bookId="book-1" currentPage={2} totalPages={100} />
      );

      expect(recordSpy).toHaveBeenCalledTimes(1);
      const payload = recordSpy.mock.calls[0][0];
      expect(payload.book_id).toBe('book-1');
      expect(payload.pages).toEqual([1]);
      expect(payload.reading_time_seconds).toBe(20);
    });

    it('records both pages when in dual-page spread mode', async () => {
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
        vi.advanceTimersByTime(25000);
      });

      // Advance to spread 4 & 5
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
      expect(payload.reading_time_seconds).toBe(25);
    });

    it('queues offline records when API fails and flushes when online', async () => {
      vi.spyOn(activityApi, 'recordActivity').mockRejectedValue(new Error('Network error'));

      const { rerender } = render(
        <TrackerTestComponent bookId="book-offline" currentPage={5} totalPages={100} />
      );

      act(() => {
        vi.advanceTimersByTime(18000);
      });

      rerender(
        <TrackerTestComponent bookId="book-offline" currentPage={6} totalPages={100} />
      );

      // Wait for async catch handler to enqueue
      await act(async () => {
        await Promise.resolve();
      });

      // Verify queued in localStorage
      const queuedRaw = localStorage.getItem('uzi_offline_activity_queue');
      expect(queuedRaw).toBeTruthy();
      const queued = JSON.parse(queuedRaw);
      expect(queued.length).toBe(1);
      expect(queued[0].book_id).toBe('book-offline');
      expect(queued[0].pages).toEqual([5]);

      // Now mock success and flush
      const successSpy = vi.spyOn(activityApi, 'recordActivity').mockResolvedValue({ status: 'ok' });
      successSpy.mockClear();
      await flushOfflineActivityQueue();

      expect(successSpy).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('uzi_offline_activity_queue')).toBeNull();
    });
  });

  describe('ReadingActivityView component', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

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

      // Verify streak is rendered
      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument();
      });

      // Verify goal met badge
      expect(screen.getByText(/Meta Batida|Goal Achieved/i)).toBeInTheDocument();

      // Verify total pages
      expect(screen.getByText('350')).toBeInTheDocument();

      // Verify completed book is displayed
      expect(screen.getByText('Finished Book')).toBeInTheDocument();

      // Verify book details for today
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
        expect(screen.getByText(/10 pág\/dia/i)).toBeInTheDocument();
      });

      // Click to edit goal
      fireEvent.click(screen.getByText(/10 pág\/dia/i));

      const input = screen.getByDisplayValue('10');
      fireEvent.change(input, { target: { value: '20' } });

      // Click check icon button
      const checkBtn = input.nextElementSibling;
      fireEvent.click(checkBtn);

      await waitFor(() => {
        expect(setGoalSpy).toHaveBeenCalledWith(20);
      });
    });
  });
});
