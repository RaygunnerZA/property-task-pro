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
  const [selectedDocumentUrl, setSelectedDocumentUrl] = useState<string | null>(null);
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
      assigned_user_id: taskData.assigned_user_id,
    };
  }, [taskData]);

  const imageAttachments = useMemo(() => {
    const attachments = Array.isArray(task?.images) ? task.images : [];
    return attachments.filter((attachment: any) => {
      const fileType = String(attachment?.file_type || "").toLowerCase();
      const fileName = String(attachment?.file_name || "").toLowerCase();
      return fileType.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif|bmp|svg)$/.test(fileName);
    });
  }, [task?.images]);

  const documentAttachments = useMemo(() => {
    const attachments = Array.isArray(task?.images) ? task.images : [];
    return attachments.filter((attachment: any) => {
      const fileType = String(attachment?.file_type || "").toLowerCase();
      return !fileType.startsWith("image/");
    });
  }, [task?.images]);

  // Reset selected image when task changes
  useEffect(() => {
    if (imageAttachments.length > 0) {
      setSelectedImageIndex(0);
    } else {
      setSelectedImageIndex(null);
    }
  }, [imageAttachments]);

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
            {imageAttachments.length > 0 ? (
              <>
                <img
                  src={imageAttachments[selectedImageIndex ?? 0]?.thumbnail_url || imageAttachments[selectedImageIndex ?? 0]?.file_url}
                  alt={imageAttachments[selectedImageIndex ?? 0]?.file_name || "Task image"}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const image = imageAttachments[selectedImageIndex ?? 0];
                    if (image?.thumbnail_url && image?.file_url) {
                      (e.target as HTMLImageElement).src = image.file_url;
                    }
                  }}
                />
                <TaskAnnotationOverlay annotations={imageAttachments[selectedImageIndex ?? 0]?.annotation_json} />
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
          {imageAttachments.length > 1 && (
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
                    {imageAttachments.map((image: any, index: number) => (
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
                {imageAttachments.length > 3 && (
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

          {documentAttachments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Documents
              </h3>
              <div className="space-y-2">
                {documentAttachments.map((document: any) => (
                  <button
                    key={document.id}
                    type="button"
                    className="w-full rounded-lg bg-muted/40 px-3 py-2 text-left shadow-e1"
                    onClick={() => setSelectedDocumentUrl(document.file_url)}
                  >
                    <p className="truncate text-sm font-medium">{document.file_name || "Document"}</p>
                    <p className="text-xs text-muted-foreground">{document.file_type || "file"}</p>
                  </button>
                ))}
              </div>
              {selectedDocumentUrl && (
                <div className="h-[320px] rounded-lg overflow-hidden border border-border/30">
                  <iframe
                    src={`${selectedDocumentUrl}#toolbar=1&navpanes=0&view=FitH`}
                    title="Task document viewer"
                    className="w-full h-full border-0"
                  />
                </div>
              )}
            </div>
          )}

          {/* Upload Zone */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Upload Images
            </h3>
            <FileUploadZone
              taskId={id!}
              propertyId={task?.property_id}
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
            <ChatThread taskId={id!} />
          </CardContent>
        </Card>
        </div>
      </div>
    </StandardPageWithBack>
  );
};

export default TaskDetail;

function TaskAnnotationOverlay({ annotations }: { annotations?: any[] }) {
  if (!Array.isArray(annotations) || annotations.length === 0) return null;
  const colorMap: Record<string, string> = {
    charcoal: "#1f2937",
    white: "#ffffff",
    "warning-orange": "#f59e0b",
    "danger-red": "#ef4444",
    "calm-blue": "#3b82f6",
    "success-green": "#22c55e",
  };
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 w-full h-full">
      {annotations.map((annotation: any) => {
        const color = colorMap[String(annotation?.strokeColor || "charcoal")] || "#1f2937";
        if (annotation?.type === "pin") {
          return <circle key={annotation.annotationId} cx={annotation.x * 100} cy={annotation.y * 100} r={1.1} fill={color} />;
        }
        if (annotation?.type === "rect") {
          return (
            <rect
              key={annotation.annotationId}
              x={annotation.x * 100}
              y={annotation.y * 100}
              width={annotation.width * 100}
              height={annotation.height * 100}
              fill="none"
              stroke={color}
              strokeWidth={0.5}
            />
          );
        }
        if (annotation?.type === "circle") {
          return (
            <circle
              key={annotation.annotationId}
              cx={annotation.x * 100}
              cy={annotation.y * 100}
              r={annotation.radius * 100}
              fill="none"
              stroke={color}
              strokeWidth={0.5}
            />
          );
        }
        if (annotation?.type === "arrow") {
          return (
            <line
              key={annotation.annotationId}
              x1={annotation.from.x * 100}
              y1={annotation.from.y * 100}
              x2={annotation.to.x * 100}
              y2={annotation.to.y * 100}
              stroke={color}
              strokeWidth={0.5}
              strokeLinecap="round"
            />
          );
        }
        if (annotation?.type === "freedraw" && Array.isArray(annotation.points) && annotation.points.length > 1) {
          const polylinePoints = annotation.points
            .map((point: any) => `${point.x * 100},${point.y * 100}`)
            .join(" ");
          return (
            <polyline
              key={annotation.annotationId}
              points={polylinePoints}
              fill="none"
              stroke={color}
              strokeWidth={0.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }
        if (annotation?.type === "text") {
          return (
            <text
              key={annotation.annotationId}
              x={annotation.x * 100}
              y={annotation.y * 100}
              fill={colorMap[String(annotation?.textColor || annotation?.strokeColor || "charcoal")] || color}
              fontSize="3"
            >
              {annotation.text}
            </text>
          );
        }
        return null;
      })}
    </svg>
  );
}
