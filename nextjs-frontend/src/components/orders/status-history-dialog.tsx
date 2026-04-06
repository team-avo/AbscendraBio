import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Clock, CheckCircle, XCircle, AlertCircle, Package, Truck, Home, Tag } from 'lucide-react';

interface StatusHistoryDialogProps {
  order: any;
  open: boolean;
  onClose: () => void;
}

export function StatusHistoryDialog({ order, open, onClose }: StatusHistoryDialogProps) {
  if (!order) return null;

  const getStatusIcon = (status: string) => {
    const icons: { [key: string]: any } = {
      PENDING: Clock,
      PROCESSING: Package,
      LABEL_CREATED: Tag,
      SHIPPED: Truck,
      DELIVERED: Home,
      CANCELLED: XCircle,
      REFUNDED: AlertCircle,
      ON_HOLD: AlertCircle,
    };
    return icons[status] || Clock;
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      PROCESSING: 'bg-blue-100 text-blue-800 border-blue-200',
      LABEL_CREATED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      SHIPPED: 'bg-purple-100 text-purple-800 border-purple-200',
      DELIVERED: 'bg-green-100 text-green-800 border-green-200',
      CANCELLED: 'bg-red-100 text-red-800 border-red-200',
      REFUNDED: 'bg-gray-100 text-gray-800 border-gray-200',
      ON_HOLD: 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
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

  // Create status timeline
  const statusTimeline = [
    {
      status: 'PENDING',
      label: 'Order Placed',
      description: 'Order has been placed and is awaiting processing',
      date: order.createdAt,
      completed: ['PENDING', 'PROCESSING', 'LABEL_CREATED', 'SHIPPED', 'DELIVERED'].includes(order.status),
    },
    {
      status: 'PROCESSING',
      label: 'Processing',
      description: 'Order is being prepared for shipment',
      date: order.status === 'PENDING' ? null : order.updatedAt,
      completed: ['PROCESSING', 'LABEL_CREATED', 'SHIPPED', 'DELIVERED'].includes(order.status),
    },
    {
      status: 'LABEL_CREATED',
      label: 'Label Printed',
      description: 'Shipping label has been printed',
      date: order.status === 'LABEL_CREATED' || order.status === 'SHIPPED' || order.status === 'DELIVERED' ? order.updatedAt : null,
      completed: ['LABEL_CREATED', 'SHIPPED', 'DELIVERED'].includes(order.status),
    },
    {
      status: 'SHIPPED',
      label: 'Shipped',
      description: 'Order has been shipped and is in transit',
      date: order.status === 'SHIPPED' || order.status === 'DELIVERED' ? order.updatedAt : null,
      completed: ['SHIPPED', 'DELIVERED'].includes(order.status),
    },
    {
      status: 'DELIVERED',
      label: 'Delivered',
      description: 'Order has been successfully delivered',
      date: order.status === 'DELIVERED' ? order.updatedAt : null,
      completed: order.status === 'DELIVERED',
    },
  ];

  // Add cancelled/refunded status if applicable
  if (['CANCELLED', 'REFUNDED', 'ON_HOLD'].includes(order.status)) {
    statusTimeline.push({
      status: order.status,
      label: getStatusLabel(order.status),
      description: order.status === 'CANCELLED' ? 'Order has been cancelled' : 
                   order.status === 'REFUNDED' ? 'Order has been refunded' :
                   'Order is on hold',
      date: order.updatedAt,
      completed: true,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5" />
            Order Status History - #{order.orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Current Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Current Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                {(() => {
                  const IconComponent = getStatusIcon(order.status);
                  return <IconComponent className="h-5 w-5" />;
                })()}
                <Badge className={getStatusColor(order.status)}>
                  {getStatusLabel(order.status)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Last updated: {order.updatedAt ? format(new Date(order.updatedAt), 'MMM dd, yyyy HH:mm') : 'Unknown'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Status Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {statusTimeline.map((item, index) => {
                  const IconComponent = getStatusIcon(item.status);
                  const isLast = index === statusTimeline.length - 1;
                  
                  return (
                    <div key={item.status} className="relative">
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          item.completed 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          {item.completed ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <IconComponent className="h-4 w-4" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`text-sm font-medium ${
                              item.completed ? 'text-gray-900' : 'text-gray-500'
                            }`}>
                              {item.label}
                            </p>
                            {item.completed && (
                              <Badge variant="outline" className="text-xs">
                                Completed
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            {item.description}
                          </p>
                          {item.date && (
                            <p className="text-xs text-muted-foreground">
                              {item.date ? format(new Date(item.date), 'MMM dd, yyyy HH:mm') : 'Unknown date'}
                            </p>
                          )}
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

          {/* Order Notes */}
          {order.notes && order.notes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Status Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {order.notes.map((note: any, index: number) => (
                    <div key={index} className="p-3 bg-muted rounded-lg">
                      <p className="text-sm">{note.note}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {note.createdAt ? format(new Date(note.createdAt), 'MMM dd, yyyy HH:mm') : 'Unknown date'}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
