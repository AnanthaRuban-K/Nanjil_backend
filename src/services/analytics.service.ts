import {
  analyticsRepository,
  type DashboardSummary,
  type RevenueAnalytics,
  type BookingAnalytics,
} from "../repositories/analytics.repository";

export class AnalyticsService {
  async getDashboardSummary(): Promise<DashboardSummary> {
    return analyticsRepository.getDashboardSummary();
  }

  async getRevenueAnalytics(
    dateFrom: string,
    dateTo: string
  ): Promise<RevenueAnalytics> {
    return analyticsRepository.getRevenueAnalytics(dateFrom, dateTo);
  }

  async getBookingAnalytics(): Promise<BookingAnalytics> {
    return analyticsRepository.getBookingAnalytics();
  }
}

// ── Singleton ──────────────────────────────────────
export const analyticsService = new AnalyticsService();