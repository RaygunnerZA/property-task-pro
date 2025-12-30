import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, MapPin, User, AlertCircle, Clock, CheckSquare, ChevronLeft, ChevronRight, Edit, X } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useDataContext } from '@/contexts/DataContext';
import { useActiveOrg } from '@/hooks/useActiveOrg';
import { ChatThread } from '@/components/messaging/ChatThread';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { LoadingState } from '@/components/design-system/LoadingState';
import { EmptyState } from '@/components/design-system/EmptyState';
import { useQuery } from '@tanstack/react-query';
import { FileUploadZone } from '@/components/attachments/FileUploadZone';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

const getStatusColor = (status: TaskStatus) => {
  switch (status) {
    case 'completed':
      return 'bg-success text-success-foreground';
    case 'in_progress':
      return 'bg-warning text-warning-foreground';
    case 'pending':
      return 'bg-primary text-primary-foreground';
    case 'cancelled':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-primary text-primary-foreground';
  }
};

interface TaskData {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  due_date: string | null;
  created_at: string;
  property_id: string | null;
  assigned_user_id: string | null;
}

interface PropertyData {
  id: string;
  nickname: string | null;
  address: string;
}

const TaskDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();
  
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const thumbnailScrollRef = useRef<HTMLDivElement>(null);

  // Fetch task from tasks_view (includes property data)
  const { data: taskData, isLoading: loading, error } = useQuery({
    queryKey: ["task", orgId, id],
    queryFn: async () => {
      if (!id || !orgId) return null;
      const { data, error } = await supabase
        .from("tasks_view")
        .select("*")
        .eq("id", id)
        .eq("org_id", orgId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!orgId && !!id && !orgLoading,
    staleTime: 60000, // 1 minute
  });

  // Parse task from view (handles JSON arrays and property data)
  const task = useMemo(() => {
    if (!taskData) return null;
    return {
      ...taskData,
      spaces: typeof taskData.spaces === 'string' ? JSON.parse(taskData.spaces) : (taskData.spaces || []),
      themes: typeof taskData.themes === 'string' ? JSON.parse(taskData.themes) : (taskData.themes || []),
      teams: typeof taskData.teams === 'string' ? JSON.parse(taskData.teams) : (taskData.teams || []),
      images: typeof taskData.images === 'string' ? JSON.parse(taskData.images) : (taskData.images || []),
      assigned_user_id: taskData.assignee_user_id,
    };
  }, [taskData]);

  // Reset selected image when task changes
  useEffect(() => {
    if (task && task.images && task.images.length > 0) {
      setSelectedImageIndex(0);
    } else {
      setSelectedImageIndex(null);
    }
  }, [task]);

  // Extract property data from task (tasks_view includes property_name and property_address)
  const property = useMemo(() => {
    if (!taskData || !taskData.property_id) return null;
    return {
      id: taskData.property_id,
      nickname: taskData.property_name || null,
      address: taskData.property_address || '',
    };
  }, [taskData]);

  // Initialize status from task - must be before early returns
  useEffect(() => {
    if (task) {
      setStatus((task.status as TaskStatus) || 'pending');
    }
  }, [task]);

  if (loading || orgLoading) {
    return (
      <StandardPageWithBack
        title="Task Details"
        backTo="/tasks"
        icon={<CheckSquare className="h-6 w-6" />}
        maxWidth="md"
      >
        <LoadingState message="Loading task..." />
      </StandardPageWithBack>
    );
  }

  if (!task) {
    return (
      <StandardPageWithBack
        title="Task Details"
        backTo="/tasks"
        icon={<CheckSquare className="h-6 w-6" />}
        maxWidth="md"
      >
        <EmptyState
          icon={CheckSquare}
          title="Task not found"
          description="The task you're looking for doesn't exist"
          action={{
            label: "Go back",
            onClick: () => navigate('/tasks')
          }}
        />
      </StandardPageWithBack>
    );
  }

  const handleStatusChange = (newStatus: TaskStatus) => {
    setStatus(newStatus);
    toast({
      title: "Status updated",
      description: `Task marked as ${newStatus.replace('-', ' ')}`,
    });
  };

  return (
    <StandardPageWithBack
      title={task.title}
      subtitle={property ? property.nickname || property.address : undefined}
      backTo="/tasks"
      icon={<CheckSquare className="h-6 w-6" />}
      maxWidth="full"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Left Column: Primary Image + Media Gallery */}
        <div className="space-y-4">
          {/* Square Primary Image */}
          <div className="aspect-square w-full bg-muted rounded-lg overflow-hidden shadow-e1 relative group">
            {task.images && task.images.length > 0 ? (
              <>
                <img
                  src={task.images[selectedImageIndex ?? 0]?.thumbnail_url || task.images[selectedImageIndex ?? 0]?.file_url}
                  alt={task.images[selectedImageIndex ?? 0]?.file_name || "Task image"}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const image = task.images[selectedImageIndex ?? 0];
                    if (image?.thumbnail_url && image?.file_url) {
                      (e.target as HTMLImageElement).src = image.file_url;
                    }
                  }}
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-1.5 bg-black/50 rounded-[5px] hover:bg-black/70 text-white"
                    onClick={() => {
                      // TODO: Open image viewer/edit dialog
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </button>
                </div>
                <div 
                  className="absolute inset-0 cursor-pointer"
                  onClick={() => {
                    // TODO: Open full image viewer
                  }}
                  title="Click to view image"
                />
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                <CheckSquare className="h-16 w-16 mb-2" />
                <span className="text-sm">No image</span>
              </div>
            )}
          </div>

          {/* Media Gallery Thumbnails - Only show when 2+ images exist */}
          {task.images && task.images.length > 1 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Media Gallery
              </h3>
              <div className="relative">
                {/* Container with overflow hidden to show only 3 thumbnails */}
                <div className="overflow-hidden" style={{ width: 'calc(3 * 6rem + 2 * 0.5rem)' }}>
                  {/* Scrollable thumbnail container */}
                  <div
                    ref={thumbnailScrollRef}
                    className="flex gap-2 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  >
                    {task.images.map((image: any, index: number) => (
                      <div
                        key={image.id}
                        className={cn(
                          "aspect-square w-24 h-24 flex-shrink-0 bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity relative group border-2",
                          selectedImageIndex === index ? "border-primary" : "border-transparent"
                        )}
                        onClick={() => setSelectedImageIndex(index)}
                      >
                        <img
                          src={image.thumbnail_url || image.file_url}
                          alt={image.file_name || "Task image"}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            if (image.thumbnail_url && image.file_url) {
                              (e.target as HTMLImageElement).src = image.file_url;
                            }
                          }}
                        />
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-1 bg-black/50 rounded-[5px] hover:bg-black/70 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              // TODO: Delete image
                            }}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Navigation arrows - only show if more than 3 images */}
                {task.images.length > 3 && (
                  <>
                    <button
                      onClick={() => {
                        if (thumbnailScrollRef.current) {
                          const scrollAmount = 104; // 96px (w-24) + 8px (gap-2)
                          thumbnailScrollRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
                        }
                      }}
                      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 p-1.5 bg-background/90 backdrop-blur-sm rounded-full shadow-md hover:bg-background border border-border transition-colors z-10"
                      aria-label="Scroll left"
                    >
                      <ChevronLeft className="h-4 w-4 text-foreground" />
                    </button>
                    <button
                      onClick={() => {
                        if (thumbnailScrollRef.current) {
                          const scrollAmount = 104; // 96px (w-24) + 8px (gap-2)
                          thumbnailScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
                        }
                      }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 p-1.5 bg-background/90 backdrop-blur-sm rounded-full shadow-md hover:bg-background border border-border transition-colors z-10"
                      aria-label="Scroll right"
                    >
                      <ChevronRight className="h-4 w-4 text-foreground" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Upload Zone */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Upload Images
            </h3>
            {/* #endregion */}
            <FileUploadZone
              taskId={id!}
              onUploadComplete={() => {
                // Invalidate React Query cache to refetch task data
                queryClient.invalidateQueries({ queryKey: ["task", orgId, id] });
                queryClient.invalidateQueries({ queryKey: ["task-attachments", id] });
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
                // Reset to first image after upload
                setSelectedImageIndex(0);
              }}
              accept="image/*"
            />
          </div>
        </div>

        {/* Right Column: Task Details */}
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl font-bold leading-tight">{task.title}</h2>
            <Badge className={getStatusColor(status)} variant="secondary">
              {status.replace('-', ' ')}
            </Badge>
          </div>

          <p className="text-muted-foreground leading-relaxed">{task.description}</p>
        </div>

        {property && (
          <Card className="shadow-e1">
            <CardHeader>
              <CardTitle className="text-lg">Property Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{property.nickname || 'Property'}</p>
                  <p className="text-sm text-muted-foreground">{property.address}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-lg">Task Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-medium">
                  {task.due_date ? format(new Date(task.due_date), 'EEEE, MMMM d, yyyy') : 'No due date'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Priority</p>
                <p className="font-medium capitalize">{task.priority || 'medium'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Assigned To</p>
                <p className="font-medium">{task.assigned_user_id || 'Unassigned'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">{format(new Date(task.created_at), 'MMM d, yyyy')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-lg">Update Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={status} onValueChange={(v) => handleStatusChange(v as TaskStatus)}>
              <SelectTrigger className="input-neomorphic">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Chat Thread */}
        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-lg">Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            {/* #endregion */}
            <ChatThread taskId={id!} />
          </CardContent>
        </Card>
        </div>
      </div>
    </StandardPageWithBack>
  );
};

export default TaskDetail;
