"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api, type BulkQuote, resolveImageUrl } from "@/lib/api";
import logger from "@/lib/logger";
import { useAuth, ProtectedRoute } from "@/contexts/auth-context";
import { toast } from "sonner";
import {
  Package,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Plus
} from "lucide-react";
import { formatDate } from "@/lib/api";
import Link from "next/link";

export default function CustomerBulkQuotesPage() {
  const { user } = useAuth();
  const [bulkQuotes, setBulkQuotes] = useState<BulkQuote[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBulkQuotes = async () => {
    if (!user?.customerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await api.getBulkQuotes({
        customerId: user.customerId,
        limit: 10
      });

      if (response.success && response.data) {
        setBulkQuotes(response.data.data || []);
      } else if (response.data || (response as any).data) {
        setBulkQuotes((response as any).data || []);
      } else {
        logger.error("Failed to load bulk quotes:", { error: response.error });
        toast.error(response.error || "Failed to load bulk quotes");
      }
    } catch (error) {
      logger.error("Error loading bulk quotes:", { error });
      toast.error("Failed to load bulk quotes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBulkQuotes();
  }, [user?.customerId]);

  const getStatusBadge = (isRead: boolean) => {
    return isRead ? (
      <Badge variant="secondary" className="bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Reviewed
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
        <Clock className="w-3 h-3 mr-1" />
        Pending Review
      </Badge>
    );
  };

  if (!user?.customerId) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Please sign in as a customer to view your bulk quote requests.</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredRoles={["CUSTOMER"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Bulk Quote Requests</h1>
            <p className="text-muted-foreground">
              Track your bulk quote requests and their status
            </p>
          </div>
          <Link href="/landing/products">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Request
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading your bulk quote requests...</div>
        ) : bulkQuotes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Bulk Quote Requests</h3>
              <p className="text-gray-600 mb-6">
                You haven't submitted any bulk quote requests yet.
              </p>
              <Link href="/landing/products">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Browse Products
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bulkQuotes.slice(0, 5).map((quote) => (
              <Card key={quote.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      {quote.product?.images?.[0] && (
                        <img
                          src={resolveImageUrl(quote.product.images[0].url)}
                          alt={quote.product.name}
                          className="w-16 h-16 rounded-lg object-cover border"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {quote.product?.name}
                          </h3>
                          {getStatusBadge(quote.isRead)}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span>Quantity: <strong>{quote.quantity} pieces</strong></span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>Requested: {formatDate(quote.createdAt)}</span>
                          </div>
                        </div>

                        {quote.notes && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-700">
                              <strong>Notes:</strong> {quote.notes}
                            </p>
                          </div>
                        )}

                        {/* {quote.isRead && quote.reader && (
                        <div className="mt-3 p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-green-700">
                            <strong>Reviewed by:</strong> {quote.reader.firstName} {quote.reader.lastName}
                          </p>
                        </div>
                      )} */}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* {bulkQuotes.length > 5 && (
            <Card>
              <CardContent className="text-center py-6">
                <p className="text-gray-600 mb-4">
                  Showing 5 of {bulkQuotes.length} bulk quote requests
                </p>
                <Link href="/bulk-quotes">
                  <Button variant="outline">
                    View All Requests
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )} */}
          </div>
        )}

        {/* Quick Stats */}
        {/* {bulkQuotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Request Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{bulkQuotes.length}</div>
                <div className="text-sm text-gray-600">Total Requests</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {bulkQuotes.filter(q => q.isRead).length}
                </div>
                <div className="text-sm text-gray-600">Reviewed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {bulkQuotes.filter(q => !q.isRead).length}
                </div>
                <div className="text-sm text-gray-600">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )} */}
      </div>
    </ProtectedRoute>
  );
}
