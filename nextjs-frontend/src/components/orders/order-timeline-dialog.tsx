import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Calendar, Clock, CheckCircle, Package, Truck, Home, CreditCard, User, FileText } from 'lucide-react';

interface OrderTimelineDialogProps {
  order: any;
  open: boolean;
  onClose: () => void;
}

export function OrderTimelineDialog({ order, open, onClose }: OrderTimelineDialogProps) {
  if (!order) return null;

  const getTimelineIcon = (type: string) => {
    const icons: { [key: string]: any } = {
      ORDER_CREATED: Calendar,
      STATUS_CHANGE: Package,
      PAYMENT: CreditCard,
      CUSTOMER_UPDATE: User,
      NOTE: FileText,
    };
    return icons[type] || Clock;
  };

  const getTimelineColor = (type: string) => {
    const colors: { [key: string]: string } = {
      ORDER_CREATED: 'bg-blue-100 text-blue-600',
      STATUS_CHANGE: 'bg-green-100 text-green-600',
      PAYMENT: 'bg-purple-100 text-purple-600',
      CUSTOMER_UPDATE: 'bg-orange-100 text-orange-600',
      NOTE: 'bg-gray-100 text-gray-600',
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      PENDING: 'Pending',
      PROCESSING: 'Processing',
      LABEL_CREATED: 'Label Printed',
      SHIPPED: 'Shipped',
      DELIVERED: 'Delivered',
      CANCELLED: 'Cancelled',
      REFUNDED: 'Refunded',
      ON_HOLD: 'On Hold',
    };
    return labels[status] || status.replace('_', ' ');
  };

  // Create timeline events
  const timelineEvents = [
    {
      type: 'ORDER_CREATED',
      title: 'Order Created',
      description: `Order #${order.orderNumber} was created`,
      date: order.createdAt,
      icon: Calendar,
    },
  ];

  // Add status changes
  if (order.status !== 'PENDING') {
    timelineEvents.push({
      type: 'STATUS_CHANGE',
      title: `Status Changed to ${getStatusLabel(order.status)}`,
      description: `Order status was updated to ${getStatusLabel(order.status).toLowerCase()}`,
      date: order.updatedAt,
      icon: Package,
    });
  }

  // Add payment events
  if (order.payments && order.payments.length > 0) {
    order.payments.forEach((payment: any, index: number) => {
      timelineEvents.push({
        type: 'PAYMENT',
        title: `Payment ${payment.status}`,
        description: `Payment of $${payment.amount} was ${payment.status.toLowerCase()}`,
        date: payment.createdAt,
        icon: CreditCard,
      });
    });
  }

  // Add order notes
  if (order.notes && order.notes.length > 0) {
    order.notes.forEach((note: any, index: number) => {
      timelineEvents.push({
        type: 'NOTE',
        title: 'Order Note Added',
        description: note.note,
        date: note.createdAt,
        icon: FileText,
      });
    });
  }

  // Sort by date
  timelineEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Calendar className="h-5 w-5" />
            Order Timeline - #{order.orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Order Number:</p>
                  <p className="font-medium">#{order.orderNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status:</p>
                  <Badge variant="outline">{order.status.replace('_', ' ')}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Amount:</p>
                  <p className="font-medium">${order.totalAmount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Items:</p>
                  <p className="font-medium">{order.items?.length || 0} products</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Timeline Events ({timelineEvents.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timelineEvents.map((event, index) => {
                  const IconComponent = getTimelineIcon(event.type);
                  const isLast = index === timelineEvents.length - 1;
                  
                  return (
                    <div key={index} className="relative">
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          getTimelineColor(event.type)
                        }`}>
                          <IconComponent className="h-4 w-4" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm">{event.title}</p>
                            <Badge variant="outline" className="text-xs">
                              {event.type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            {event.description}
                          </p>
                          {/* <p className="text-xs text-muted-foreground">
                            {event.date ? format(new Date(event.date), 'MMM dd, yyyy HH:mm') : 'Unknown date'}
                          </p> */}
                        </div>
                      </div>
                      
                      {!isLast && (
                        <div className="absolute left-4 top-8 w-px h-6 bg-gray-200" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Key Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Key Dates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Order Created</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {order.createdAt ? format(new Date(order.createdAt), 'MMM dd, yyyy HH:mm') : 'Unknown'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Last Updated</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {order.updatedAt ? format(new Date(order.updatedAt), 'MMM dd, yyyy HH:mm') : 'Unknown'}
                  </span>
                </div>

                {/* {order.payments && order.payments.length > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Last Payment</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {order.payments[0].createdAt ? format(new Date(order.payments[0].createdAt), 'MMM dd, yyyy HH:mm') : 'Unknown'}
                    </span>
                  </div>
                )} */}

                {order.notes && order.notes.length > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Last Note</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {order.notes[order.notes.length - 1].createdAt ? format(new Date(order.notes[order.notes.length - 1].createdAt), 'MMM dd, yyyy HH:mm') : 'Unknown'}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
